import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize } from 'rxjs';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { CategoryService } from 'src/app/services/category.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from 'src/environments/environment';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-pos-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, OnlyNumbersDirective],
  templateUrl: './pos-caja.component.html'
})
export class PosCajaComponent implements OnInit {
  ambiente = '';
  showPaymentModal = false;
  showCustomerModal = false;
  showPrintModal = false;
  isSubmittingOrder = false;

  amountReceived: number | null = null;
  change = 0;

  products: any[] = [];
  filteredProductList: any[] = [];
  categories: any[] = [];
  payments: any[] = [];

  identificationCustomer = '';
  customer: any = null;
  alias = '';
  searchTerm = '';
  selectedCategory = '';
  orderType: 'Servirse' | 'Llevar' | 'Domicilio' = 'Servirse';
  deliveryAddress = '';
  deliveryPhone = '';
  paymentMethod = '01';

  printOption: 'comanda' | 'recibo' | 'ambas' = 'ambas';
  private pendingOrderId: string | null = null;
  private today = '';
  private readonly url = environment.URL;

  submitted = false;
  clienteForm!: FormGroup;
  identificationTypes = VARIABLE_CONSTANTS.IDENTIFICATION_TYPE;

  constructor(
    public menuService: MenuService,
    private customersService: CustomersService,
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private paymentsService: PaymentsService,
    private fb: FormBuilder,
    private ordersService: OrdersService,
    private spinner: NgxSpinnerService,
    private printService: PrintService,
    public cartService: CartService,
    public alertService: AlertService
  ) { }

  ngOnInit(): void {
    this.ambiente = localStorage.getItem('ambiente') ?? '---';
    this.today = this.buildEcuadorIsoDate();
    this.initClienteForm();
    this.loadInitialData();
  }

  get f() {
    return this.clienteForm.controls;
  }

  get subtotal(): number {
    return this.round2(this.cartService.cart.reduce((acc, it) => acc + this.toNumber(it.subtotal), 0));
  }

  get iva(): number {
    return this.round2(this.cartService.cart.reduce((acc, it) => acc + this.toNumber(it.iva), 0));
  }

  get total(): number {
    return this.round2(this.cartService.cart.reduce((acc, it) => acc + this.toNumber(it.total), 0));
  }

  get canCheckout(): boolean {
    return !!this.customer && this.cartService.cart.length > 0 && !this.isSubmittingOrder;
  }

  get selectedPaymentName(): string {
    const payment = this.payments.find((p: any) => p.codigo === this.paymentMethod);
    return payment?.description || payment?.nombre || 'Metodo de pago';
  }

  toggleSidebar(): void {
    this.menuService.toggleSidebar();
  }

  setOrderType(tipo: 'Servirse' | 'Llevar' | 'Domicilio'): void {
    this.orderType = tipo;
  }

  onPaymentMethodChange(): void {
    if (this.paymentMethod !== '01') {
      this.amountReceived = null;
      this.change = 0;
      return;
    }
    this.calcularCambio();
  }

  loadProducts(): void {
    this.spinner.show();
    this.productsService.getAll(1).pipe(finalize(() => this.spinner.hide())).subscribe({
      next: (res: any) => {
        this.products = res?.message?.data || [];
        this.applyFilters();
      },
      error: () => {
        toast.error('Error al cargar productos.');
      }
    });
  }

  loadCategory(): void {
    this.spinner.show();
    this.categoryService.getAll().pipe(finalize(() => this.spinner.hide())).subscribe({
      next: (res: any) => {
        this.categories = res?.message?.data || [];
      },
      error: () => {
        toast.error('Error al cargar categorias.');
      }
    });
  }

  loadMethodPayment(): void {
    this.spinner.show();
    this.paymentsService.getAll().pipe(finalize(() => this.spinner.hide())).subscribe({
      next: (res: any) => {
        this.payments = res || [];
      },
      error: () => {
        toast.error('Error al cargar metodos de pago.');
      }
    });
  }

  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim();
    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      toast.warning('La identificacion debe tener 10 o 13 digitos.');
      return;
    }

    this.spinner.show();
    this.customersService.get_cliente_by_identificacion(identification).pipe(
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (res: any) => {
        this.customer = res?.message || null;
      },
      error: () => {
        this.customer = null;
        const tipoIdentificacion = identification.length === 10 ? '05 - Cedula' : '04 - RUC';
        this.clienteForm.patchValue({
          num_identificacion: identification,
          tipo_identificacion: tipoIdentificacion
        });
        this.showCustomerModal = true;
        toast.error('Cliente no encontrado con esa identificacion.');
      }
    });
  }

  selectFinalConsumer(): void {
    this.identificationCustomer = '9999999999999';
    this.findByIdentificationCustomer();
  }

  guardarCliente(): void {
    this.submitted = true;
    if (this.clienteForm.invalid) return;

    this.spinner.show();
    this.customersService.create(this.clienteForm.getRawValue()).pipe(
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (res: any) => {
        toast.success('Cliente creado exitosamente.');
        this.customer = res?.message?.data;
        this.identificationCustomer = this.customer?.num_identificacion || '';
        this.cerrarModal();
      },
      error: (err) => {
        const apiMessage = this.extractApiError(err);
        toast.error(apiMessage || 'Error al crear el cliente.');
      }
    });
  }

  applyFilters(): void {
    const term = this.normalize(this.searchTerm);
    const selectedCat = this.normalize(this.selectedCategory);

    this.filteredProductList = (this.products || []).filter((product: any) => {
      const prodCat = this.normalize(this.getProductCategoryName(product));
      const okCat = !selectedCat || prodCat === selectedCat;
      if (!term) return okCat;

      const name = this.normalize(product?.nombre ?? product?.name);
      const desc = this.normalize(product?.description ?? product?.descripcion);
      return okCat && (name.includes(term) || desc.includes(term));
    });
  }

  addProduct(product: any): void {
    if (product?.is_out_of_stock) return;

    const existing = this.cartService.cart.find(i => (i.name ?? i.nombre) === (product.name ?? product.nombre));
    const price = this.toNumber(product.precio ?? product.price);
    const taxValue = this.getTaxPercent(product);

    if (existing) {
      existing.quantity++;
      this.recalcItem(existing);
      return;
    }

    const newItem = {
      ...product,
      nombre: product?.nombre ?? product?.name,
      price,
      quantity: 1,
      tax_value: taxValue
    };
    this.recalcItem(newItem);
    this.cartService.cart.push(newItem);
  }

  increase(item: any): void {
    item.quantity++;
    this.recalcItem(item);
  }

  decrease(item: any): void {
    if (item.quantity > 1) {
      item.quantity--;
      this.recalcItem(item);
      return;
    }
    this.remove(item);
  }

  remove(item: any): void {
    const index = this.cartService.cart.indexOf(item);
    if (index !== -1) {
      this.cartService.cart.splice(index, 1);
    }
  }

  abrirModalPago(): void {
    if (!this.customer) {
      toast.error('Selecciona un cliente.');
      return;
    }
    if (this.cartService.cart.length === 0) {
      toast.error('Agrega productos al carrito.');
      return;
    }
    if (this.orderType === 'Domicilio' && (!this.deliveryAddress.trim() || !this.deliveryPhone.trim())) {
      toast.error('Completa direccion y telefono para pedidos a domicilio.');
      return;
    }

    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = true;
  }

  calcularCambio(): void {
    if (this.paymentMethod !== '01') {
      this.change = 0;
      return;
    }
    const recibido = Number(this.amountReceived);
    this.change = Number.isFinite(recibido) ? this.round2(recibido - this.total) : 0;
  }

  confirmarPago(typePago: 'Nota Venta' | 'Factura'): void {
    if (this.isSubmittingOrder) return;

    if (this.paymentMethod === '01' && this.change < 0) {
      toast.error('El monto recibido es menor al total.');
      return;
    }

    const TYPE_IDENTIFICATION_CF = '07 - Consumidor Final';
    const UMBRAL = 50;
    const isConsumidorFinal = this.customer?.tipo_identificacion === TYPE_IDENTIFICATION_CF;
    if (isConsumidorFinal && typePago === 'Factura' && this.total >= UMBRAL) {
      toast.error(`Consumidor final no puede facturar un monto mayor o igual a $${UMBRAL}.`);
      return;
    }

    const payload = this.buildOrderPayload(typePago);
    if (!payload) return;

    if (typePago === 'Factura') {
      this.alertService.confirm('Deseas continuar con la factura?', 'Esta accion no se puede deshacer.')
        .then((result) => {
          if (result.isConfirmed) this.submitOrder(payload);
        });
      return;
    }

    this.submitOrder(payload);
  }

  async saveOrderMesero(): Promise<void> {
    if (this.cartService.cart.length === 0) {
      toast.error('Agrega productos al carrito.');
      return;
    }
    if (!this.alias.trim()) {
      toast.error('Ingresa un alias.');
      return;
    }
    if (this.orderType === 'Domicilio' && (!this.deliveryAddress.trim() || !this.deliveryPhone.trim())) {
      toast.error('Completa direccion y telefono para pedidos a domicilio.');
      return;
    }

    const order = {
      alias: this.alias.trim(),
      estado: 'Nota Venta',
      total: this.total.toFixed(2),
      type_orden: this.orderType,
      delivery_address: this.deliveryAddress,
      delivery_phone: this.deliveryPhone,
      fecha: this.today,
      items: this.cartService.cart.map(item => ({
        product: item.name ?? item.nombre,
        qty: item.quantity,
        rate: item.price,
        tax_rate: item.tax_value
      }))
    };

    const result = await this.alertService.confirm('Desea crear la orden?', 'Confirmacion');
    if (!result.isConfirmed) return;

    this.isSubmittingOrder = true;
    this.spinner.show();
    this.ordersService.create_order_v2(order).pipe(finalize(() => {
      this.isSubmittingOrder = false;
      this.spinner.hide();
    })).subscribe({
      next: (res: any) => {
        toast.success('Orden creada.');
        this.pendingOrderId = res?.message?.name || null;
        this.clearPage();
      }
    });
  }

  openPrintModal(orderId: string): void {
    this.pendingOrderId = orderId;
    this.showPaymentModal = false;
    this.showPrintModal = true;
  }

  handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas'): void {
    if (!this.pendingOrderId) return;

    if (option === 'comanda') this.openPrintWindow(this.printService.getComanda(this.pendingOrderId));
    if (option === 'recibo') this.openPrintWindow(this.printService.getRecibo(this.pendingOrderId));
    if (option === 'ambas') this.openPrintWindow(this.printService.getOrderPdf(this.pendingOrderId));

  }

  closePrintModal(): void {
    this.showPrintModal = false;
    this.pendingOrderId = null;
    this.clearPage();
  }

  onCategorySelected(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  onSearchTermChanged(term: string): void {
    this.searchTerm = term;
    this.applyFilters();
  }

  cerrarModal(): void {
    this.showCustomerModal = false;
    this.submitted = false;
    this.clienteForm.reset({
      nombre: '',
      num_identificacion: '',
      tipo_identificacion: '05 - Cédula',
      correo: '',
      telefono: '',
      direccion: ''
    });
  }

  clearPage(): void {
    this.cartService.clear();
    this.customer = null;
    this.alias = '';
    this.identificationCustomer = '';
    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = false;
    this.orderType = 'Servirse';
    this.deliveryAddress = '';
    this.deliveryPhone = '';
    this.searchTerm = '';
    this.onCategorySelected('');
  }

  identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
      const valor = `${control.value || ''}`;
      if (!valor) return null;
      if (String(tipo).slice(0, 2) === '05' && valor.length !== 10) return { cedulaInvalida: true };
      if (String(tipo).slice(0, 2) === '04' && valor.length !== 13) return { rucInvalido: true };
      return null;
    };
  }

  getMaxLength(): number {
    const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
    return String(tipo)?.slice(0, 2) === '05' ? 10 : 13;
  }

  trackByProductId = (_: number, p: any) => p?.id || p?._id || p?.codigo || p?.name || p?.nombre;

  private initClienteForm(): void {
    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required]],
      num_identificacion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(13)]],
      tipo_identificacion: ['05 - Cédula', [Validators.required]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required]],
      direccion: ['', [Validators.required]]
    });

    this.clienteForm.get('tipo_identificacion')?.valueChanges.subscribe(() => {
      this.clienteForm.patchValue({ num_identificacion: '' });
      this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    });

    this.clienteForm.get('num_identificacion')?.setValidators([
      Validators.required,
      this.identificacionLengthValidator()
    ]);
  }

  private loadInitialData(): void {
    this.loadProducts();
    this.loadCategory();
    this.loadMethodPayment();
  }

  private buildOrderPayload(typePago: 'Nota Venta' | 'Factura') {
    const payment = this.payments.find((p: any) => p.codigo === this.paymentMethod);
    if (!payment) {
      toast.error('Selecciona un metodo de pago valido.');
      return null;
    }

    return {
      customer: this.customer?.name,
      alias: this.alias.trim(),
      estado: typePago,
      total: this.total.toFixed(2),
      type_orden: this.orderType,
      delivery_address: this.deliveryAddress,
      delivery_phone: this.deliveryPhone,
      fecha: this.today,
      items: this.cartService.cart.map(item => ({
        product: item.name ?? item.nombre,
        qty: item.quantity,
        rate: item.price,
        tax_rate: item.tax_value
      })),
      payments: [{ formas_de_pago: payment?.name }]
    };
  }

  private submitOrder(payload: any): void {
    this.isSubmittingOrder = true;
    this.spinner.show();
    this.ordersService.create_order_v2(payload).pipe(finalize(() => {
      this.isSubmittingOrder = false;
      this.spinner.hide();
    })).subscribe({
      next: (res: any) => {
        const orderId = res?.message?.name;
        if (!orderId) {
          toast.error('No se recibio numero de orden.');
          return;
        }
        toast.success(`Pedido guardado${this.paymentMethod === '01' ? `. Cambio: $${this.change.toFixed(2)}` : ''}`);
        this.openPrintModal(orderId);
      }
    });
  }

  private openPrintWindow(path: string): void {
    const url = this.url + path;
    const width = 900;
    const height = 820;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes'
    ];

    const printWindow = window.open(url, '_blank', features.join(','));
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresion.');
    }
  }

  private buildEcuadorIsoDate(): string {
    const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
    return date.toISOString();
  }

  private extractApiError(err: any): string | null {
    if (err?.error?._server_messages) {
      try {
        const messages = JSON.parse(err.error._server_messages);
        const mensaje = JSON.parse(messages[0]);
        return this.stripHtml(mensaje.message);
      } catch {
        return null;
      }
    }
    if (err?.error?.message) return err.error.message;
    return null;
  }

  private stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private getTaxPercent(p: any): number {
    const v = Number(p?.tax_value ?? p?.tax?.value ?? p?.tax ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  private recalcItem(item: any): void {
    const qty = this.toNumber(item.quantity);
    const price = this.toNumber(item.price);
    const taxRate = this.toNumber(item.tax_value) / 100;
    const subtotal = this.round2(qty * price);
    const iva = this.round2(subtotal * taxRate);
    item.subtotal = subtotal;
    item.iva = iva;
    item.total = this.round2(subtotal + iva);
  }

  private normalize(txt: any = ''): string {
    return String(txt ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getProductCategoryName(p: any): string {
    return p?.categoria || p?.category?.name || p?.category?.nombre || '';
  }
}
