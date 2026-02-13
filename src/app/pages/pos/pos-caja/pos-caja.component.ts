import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CategoryService } from 'src/app/services/category.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { finalize } from 'rxjs';
import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { AuthService } from 'src/app/services/auth.service';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { CartService } from '../services/cart.service';
import { environment } from 'src/environments/environment';
import { AlertService } from 'src/app/core/services/alert.service';

type RoleName = 'Cajero' | 'Mesero' | 'Gerente' | 'Desconocido';
@Component({
  selector: 'app-pos-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, OnlyNumbersDirective, ButtonComponent],
  templateUrl: './pos-caja.component.html',
})
export class PosCajaComponent implements OnInit {
  ambiente: string = '';
  showPaymentModal: boolean = false;
  amountReceived: number | null = null;
  change: number = 0;

  products: any = [];
  filteredProductList: any[] = [];

  categories: any = [];
  payments: any = [];

  identificationCustomer: string = '';
  customer: any = null;
  alias: string = '';
  // cart: any[] = [];
  searchTerm: string = '';
  selectedCategory = '';
  orderType: 'Servirse' | 'Llevar' | 'Domicilio' = 'Servirse';
  deliveryAddress: string = '';
  deliveryPhone: string = '';

  paymentMethod: string = '01';

  showCustomerModal = false;

  showPrintModal = false;
  printOption: 'comanda' | 'recibo' | 'ambas' = 'ambas';
  private pendingOrderId: string | null = null;

  submitted = false;
  clienteForm!: FormGroup;

  today: any;

  private url = environment.URL;

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
    private auth: AuthService,
    public cartService: CartService,
    public alertService: AlertService,
  ) {

  }

  ngOnInit(): void {
    const ambienteGuardado = localStorage.getItem('ambiente');
    console.log('📦ambienteGuardado', ambienteGuardado);
    this.ambiente = ambienteGuardado ?? '----------';

    const fechaEcuador = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
    console.log('📦fechaEcuador', fechaEcuador);

    this.today = fechaEcuador.toISOString();
    console.log('📦this.today', this.today);

    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required]],
      num_identificacion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(13)]],
      tipo_identificacion: ['05 - Cédula', [Validators.required]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required]],
      direccion: ['', [Validators.required]],
    });

    this.loadProducts();
    this.loadCategory();
    this.loadMethodPayment();

    // Validación dinámica por tipo de identificación
    this.clienteForm.get('tipo_identificacion')?.valueChanges.subscribe(() => {
      this.clienteForm.patchValue({ num_identificacion: null });
      this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    });
    this.clienteForm.get('num_identificacion')?.setValidators([
      Validators.required,
      this.identificacionLengthValidator()
    ]);
  }


  // ======= UI helpers =======
  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }
  get f() {
    return this.clienteForm.controls;
  }

  setOrderType(tipo: 'Servirse' | 'Llevar' | 'Domicilio') {
    this.orderType = tipo;
  }

  // Si planeas marcar ítems "Llevar" por separado:
  setItemType(item: any, tipo: 'Servirse' | 'Llevar') {
    item.tipo = tipo;
  }

  // ======= Data loading =======
  loadProducts() {
    this.spinner.show();
    this.productsService.getAll(1).subscribe((res: any) => {
      this.spinner.hide();
      this.products = res.message.data || [];
      this.applyFilters();
    },
      error => {
        this.spinner.hide();
        console.error('Error al cargar productos:', error);
      }
    );
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.categories = res.message.data || [];
    },
      error => {
        this.spinner.hide();
        console.error('Error al cargar productos:', error);
      });
  }

  loadMethodPayment() {
    this.spinner.show();
    this.paymentsService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.payments = res || [];
    },
      error => {
        this.spinner.hide();
        console.error('Error al cargar productos:', error);
      }
    );
  }

  // ======= Cliente =======
  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim();

    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      toast.warning('La identificación debe tener 10 o 13 digitos.');
      return;
    }

    this.spinner.show();
    this.customersService.get_cliente_by_identificacion(identification).subscribe({
      next: (res) => {
        this.customer = res.message;
      },
      error: (err) => {
        console.error('Error al buscar cliente:', err);
        this.customer = null;
        let tipo_identificacion = '';
        if (this.identificationCustomer.length === 10) {
          tipo_identificacion = '05 - Cedula';
        } else if (this.identificationCustomer.length === 13) {
          tipo_identificacion = '04 - RUC';
        }
        this.clienteForm.patchValue({ identification: this.identificationCustomer, tipo_identificacion: tipo_identificacion });
        this.showCustomerModal = true;
        this.clienteForm.patchValue({
          num_identificacion: this.identificationCustomer,
        });
        toast.error('Cliente no encontrado con esa identificación');
        this.spinner.hide();
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  selectFinalConsumer() {
    this.identificationCustomer = '9999999999999';
    this.findByIdentificationCustomer();
  }

  guardarCliente() {
    this.submitted = true;
    if (this.clienteForm.invalid) return;

    this.customersService.create(this.clienteForm.getRawValue()).subscribe({
      next: (res) => {
        toast.success('Cliente creado exitosamente');
        this.cerrarModal();
        this.customer = res.message.data;
        this.identificationCustomer = this.customer.num_identificacion;
      },
      error: (err) => {
        if (err.error && err.error._server_messages) {
          try {
            const messages = JSON.parse(err.error._server_messages);
            const mensaje = JSON.parse(messages[0]);
            const mensajeLimpio = this.stripHtml(mensaje.message);
            toast.error('Error: ' + mensajeLimpio);
          } catch (e) {
            toast.error('Ocurrió un error al procesar la respuesta del servidor.');
            console.error('Error al parsear mensaje del servidor:', e);
          }
        } else if (err.error && err.error.message) {
          toast.error('Error: ' + err.error.message);
        } else {
          toast.error('Error desconocido al crear el cliente.');
        }
        console.error('Error al crear cliente:', err);
      }
    });
  }

  stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  // ======= Productos / Carrito =======
  applyFilters() {
    const term = this.normalize(this.searchTerm);
    const selectedCat = this.normalize(this.selectedCategory);

    this.filteredProductList = (this.products || []).filter((product: any) => {
      const prodCat = this.normalize(this.getProductCategoryName(product));
      const okCat = !selectedCat || prodCat === selectedCat;
      if (!term) return okCat;

      const name = this.normalize(product?.nombre ?? product?.name);
      const desc = this.normalize(product?.description ?? product?.descripcion);
      const okText = name.includes(term) || desc.includes(term);
      return okCat && okText;
    });
  }

  addProduct(product: any) {
    const existing = this.cartService.cart
      .find(i => (i.name ?? i.nombre) === (product.name ?? product.nombre));
    const price = this.toNumber(product.precio ?? product.price);
    const taxValue = this.getTaxPercent(product); // 0 o 15

    if (existing) {
      existing.quantity++;
      this.recalcItem(existing);
    } else {
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
  }

  increase(item: any) {
    item.quantity++;
    this.recalcItem(item);
  }

  decrease(item: any) {
    if (item.quantity > 1) {
      item.quantity--;
      this.recalcItem(item);
    } else {
      const i = this.cartService.cart.indexOf(item);
      if (i !== -1) this.cartService.cart.splice(i, 1);
    }
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

  // ======= Pago (solo Cajero/Gerente) =======
  abrirModalPago() {

    if (!this.customer) {
      toast.error('Selecciona un cliente.');
      this.identificationCustomer = '';
      return;
    }
    if (this.cartService.cart.length === 0) {
      toast.error('Agrega productos al carrito.');
      return;
    }

    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = true;
  }

  calcularCambio() {
    if (this.paymentMethod === '01') {
      const recibido = Number(this.amountReceived);
      if (Number.isFinite(recibido)) {
        this.change = recibido - this.cartService.total;
      } else {
        this.change = 0;
      }
    }
  }

  confirmarPago(typePago: string) {
    const payment = this.payments.find((p: any) => p.codigo === this.paymentMethod);
    const TYPE_IDENTIFICATION_RUC = "07 - Consumidor Final";
    const UMBRAL = 50;

    const isConsumidorFinal = this.customer?.tipo_identificacion === TYPE_IDENTIFICATION_RUC;
    const totalN = Number(this.cartService.total);

    if (isConsumidorFinal && typePago === 'Factura' && totalN >= UMBRAL) {
      toast.error(`El consumidor final no puede facturar por un monto mayor o igual a $${UMBRAL}.`);
      return;
    }

    const order = {
      customer: this.customer?.name,
      alias: this.alias,
      estado: typePago,
      total: this.cartService.total.toFixed(2),
      type_orden: this.orderType,
      delivery_address: this.deliveryAddress,
      delivery_phone: this.deliveryPhone,
      fecha: this.today,
      items: this.cartService.cart.map(item => ({
        product: item.name ?? item.nombre, // asegúrate que sea el código correcto
        qty: item.quantity,
        rate: item.price,
        tax_rate: item.tax_value
      })),
      payments: [
        {
          formas_de_pago: payment?.name,
        }
      ]
    };

    if (typePago === 'Factura') {
      this.alertService.confirm('¿Deseas continuar con la factura?', 'Esta acción no se puede deshacer.').then((result) => {
        if (result.isConfirmed) {
          this.spinner.show();
          this.ordersService.create_order_v2(order).pipe(finalize(() => this.spinner.hide()))
            .subscribe({
              next: (res: any) => {
                const orderId = res.message?.name;
                this.pendingOrderId = orderId;
                toast.success(`Pedido guardado. ${this.paymentMethod === '01' ? 'Cambio: $' + this.change.toFixed(2) : ''}`);
                this.openPrintModal(orderId);
              },
              error: () => { },
              complete: () => { }
            });
        }
      });
      return;
    }

    this.spinner.show();
    this.ordersService.create_order_v2(order).subscribe({
      next: (res) => {
        const orderId = res.message?.name;
        this.pendingOrderId = orderId;
        toast.success(`Pedido guardado. ${this.paymentMethod === '01' ? 'Cambio: $' + this.change.toFixed(2) : ''}`);
        this.openPrintModal(orderId);
      },
      error: () => {
        toast.error('Error al guardar el pedido.');
      },
      complete: () => this.spinner.hide()
    });
  }

  // ======= Flujo Mesero (enviar a cocina) =======
  async saveOrderMesero() {
    if (this.cartService.cart.length === 0) {
      toast.error('Agrega productos al carrito.');
      return;
    }

    if (!this.alias) {
      toast.error('Ingresa un alias.');
      this.identificationCustomer = '';
      return;
    }

    const order = {
      // Para mesero no exigimos cliente
      alias: this.alias,
      estado: 'Nota Venta', // etiqueta para tu backend
      total: this.cartService.total.toFixed(2), // puede no ser usado para cocina
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
      // sin payments
    };
    const result = await this.alertService.confirm('¿Desea crear la orden?', 'Confirmación');
    console.log('result', result);
    if (!result.isConfirmed) return;

    console.log('paso todo esto');

    this.spinner.show();
    this.ordersService.create_order_v2(order).subscribe({
      next: (res: any) => {
        const orderId = res.message?.name;
        this.pendingOrderId = orderId;
        toast.success('Orden creada.');
        // Para mesero, por defecto solo comanda
        //this.printComanda(orderId);
        this.clearPage();
      },
      error: () => {
        toast.error('Error al enviar la comanda.');
      },
      complete: () => this.spinner.hide()
    });
  }

  // ======= Impresiones =======
  showKitchenTicket = false;
  showReceipt = false;

  printCombinedTicket(orderId: string) {
    const order = this.url + this.printService.getOrderPdf(orderId);
    const width = 800;
    const height = 800;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const features = [
      `width=${width}`, `height=${height}`, `left=${left}`, `top=${top}`,
      'toolbar=no', 'location=no', 'directories=no', 'status=no',
      'menubar=no', 'scrollbars=yes', 'resizable=yes',
    ];
    const printWindow = window.open(order, '_blank', features.join(','));
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
    this.clearPage();
  }

  printComanda(orderId: string) {
    const order = this.url + this.printService.getComanda(orderId);
    const width = 800;
    const height = 800;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const features = [
      `width=${width}`, `height=${height}`, `left=${left}`, `top=${top}`,
      'toolbar=no', 'location=no', 'directories=no', 'status=no',
      'menubar=no', 'scrollbars=yes', 'resizable=yes',
    ];
    const printWindow = window.open(order, '_blank', features.join(','));
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
    this.clearPage();
  }

  printOrden(orderId: string) {
    const order = this.url + this.printService.getRecibo(orderId);
    const width = 800;
    const height = 800;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const features = [
      `width=${width}`, `height=${height}`, `left=${left}`, `top=${top}`,
      'toolbar=no', 'location=no', 'directories=no', 'status=no',
      'menubar=no', 'scrollbars=yes', 'resizable=yes',
    ];
    const printWindow = window.open(order, '_blank', features.join(','));
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
    this.clearPage();
  }

  // Abre el modal después de crear el pedido
  openPrintModal(orderId: string) {
    this.pendingOrderId = orderId;
    this.showPrintModal = true;
  }

  handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas') {
    if (!this.pendingOrderId) return;

    switch (option) {
      case 'comanda':
        this.printComanda(this.pendingOrderId);
        break;
      case 'recibo':
        this.printOrden(this.pendingOrderId);
        break;
      case 'ambas':
        this.printCombinedTicket(this.pendingOrderId);
        break;
    }

    //this.showPrintModal = false;
    //this.pendingOrderId = null;
  }

  closePrintModal() {
    this.showPrintModal = false;
    this.pendingOrderId = null;
    this.clearPage();
  }

  // ======= Categorías / búsqueda =======
  onCategorySelected(category: string) {
    this.selectedCategory = category;
    this.applyFilters();
  }

  onSearchTermChanged(term: string) {
    this.searchTerm = term;
    this.applyFilters();
  }

  // ======= Modales / helpers =======
  cerrarModal() {
    this.showCustomerModal = false;
    this.submitted = false;
    this.clienteForm.reset();
  }

  clearPage() {
    this.cartService.clear();
    this.customer = null;
    this.alias = '';
    this.identificationCustomer = '';
    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = false;
    this.showReceipt = false;
    this.showKitchenTicket = false;
    this.orderType = 'Servirse';
    this.deliveryAddress = '';
    this.deliveryPhone = '';
    this.searchTerm = '';
    this.onCategorySelected('');
  }

  // ======= Validaciones / utilidades =======
  identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
      const valor = control.value;

      if (!valor) return null;
      if (String(tipo).slice(0, 2) === '05' && valor?.length !== 10) {
        return { cedulaInvalida: true };
      }
      if (String(tipo).slice(0, 2) === '04' && valor?.length !== 13) {
        return { rucInvalido: true };
      }
      return null;
    };
  }

  getMaxLength(): number {
    const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
    if (String(tipo)?.slice(0, 2) === '05') return 10;
    return 13;
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
  /** % IVA desde el producto */
  private getTaxPercent(p: any): number {
    const v = Number(p?.tax_value ?? p?.tax?.value ?? p?.tax ?? 0);
    return Number.isFinite(v) ? v : 0;
  }
  /** Recalcula item */
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

  /** Normaliza texto */
  private normalize(txt: any = ''): string {
    return String(txt ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /** Nombre de categoría del producto */
  private getProductCategoryName(p: any): string {
    return (
      p?.categoria ||
      p?.category?.name ||
      p?.category?.nombre ||
      ''
    );
  }
remove(item: any) {
  const index = this.cartService.cart.indexOf(item);
  if (index !== -1) {
    this.cartService.cart.splice(index, 1);
  }
}




  trackByProductId = (_: number, p: any) => p?.id || p?._id || p?.codigo || p?.name || p?.nombre;
}
