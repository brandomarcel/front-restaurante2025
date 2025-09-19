import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize, Subscription } from 'rxjs';

import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { AlertService } from '../../core/services/alert.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { ProductsService } from 'src/app/services/products.service';
import { PrintService } from 'src/app/services/print.service';
import { Product } from '../../core/models/product';
import { InvoicesService } from 'src/app/services/invoices.service';
import { UtilsService } from '../../core/services/utils.service';
import { Customer } from 'src/app/core/models/customer';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';

type Payment = { name: string; codigo: string; nombre: string; };
type CartItem = {
  name?: string; nombre?: string; description?: string; codigo?: string;
  quantity: number; price: number; discount_pct: number; tax?: string | null; total: number;
  tax_value?: number
};

@Component({
  selector: 'app-invoicing',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, ButtonComponent],
  templateUrl: './invoicing.component.html',
  styleUrls: ['./invoicing.component.css']
})
export class InvoicingComponent implements OnInit, OnDestroy {
    identificationTypes = VARIABLE_CONSTANTS.IDENTIFICATION_TYPE; // Lista de estados para el dropdown
  
  // --- Formularios ---
  invoiceForm!: FormGroup;
  customerForm!: FormGroup;

  product: Product | null = null;

  // --- Datos ---
  customers: Customer[] = [];
  products: Product[] = [];
  payments: Payment[] = [];

  // --- Estado UI ---
  selectedCustomer: Customer | null = null;
  cartItems: CartItem[] = [];
  showCustomerModal = false;
  submittedCustomerForm = false;
  ambiente: string = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private customersService: CustomersService,
    private productsService: ProductsService,
    private paymentsService: PaymentsService,
    private ordersService: OrdersService,
    private printService: PrintService,
    private spinner: NgxSpinnerService,
    private alertService: AlertService,
    private fb: FormBuilder,
    private invoicesService: InvoicesService,
    private utilsService: UtilsService,

  ) { }

  ngOnInit(): void {
    const ambienteGuardado = localStorage.getItem('ambiente');
    console.log('📦ambienteGuardado', ambienteGuardado);
    this.ambiente = ambienteGuardado ?? '----------';
    this.initializeForms();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ------------------ Inicialización ------------------
  private initializeForms(): void {
    this.customerForm = this.fb.group({
      nombre: ['', Validators.required],
      num_identificacion: ['', [Validators.required, this.identificacionLengthValidator()]],
      tipo_identificacion: ['05 - Cedula', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.required],
      direccion: ['', Validators.required],
    });

    this.invoiceForm = this.fb.group({
      selectedCustomer: [null, Validators.required],
      selectedProduct: [null],
      paymentMethod: ['01', Validators.required],
      alias: [''],
      postingDate: [this.utilsService.getSoloFechaEcuador(), Validators.required], // YYYY-MM-DD, Validators.required],
      // company: [null, Validators.required], // <-- descomenta si usas el select de compañía
    });

    const sub = this.customerForm.get('tipo_identificacion')?.valueChanges.subscribe(() => {
      this.customerForm.get('num_identificacion')?.reset();
    });
    if (sub) this.subscriptions.push(sub);
  }

  private loadInitialData(): void {
    this.loadCustomers();
    this.loadProducts();
    this.loadPaymentMethods();
  }

  // ------------------ Carga de datos ------------------
  loadCustomers(): void {
    this.spinner.show();
    this.customersService.getAll(1).subscribe({
      next: (res: any) => this.customers = (res?.message.data || []) as Customer[],
      error: () => toast.error('Error al cargar la lista de clientes.'),
      complete: () => this.spinner.hide()
    });
  }

  loadProducts(): void {
    this.spinner.show();
    this.productsService.getAll(1).subscribe({
      next: (res: any) => {
        const all = (res.message.data || []) as Product[];
        this.products = all.filter(p => Number((p as any).isactive) === 1);
        console.log('Productos cargados:', this.products);
      },
      error: () => toast.error('Error al cargar la lista de productos.'),
      complete: () => this.spinner.hide()
    });
  }

  loadPaymentMethods(): void {
    this.spinner.show();
    this.paymentsService.getAll().subscribe({
      next: (res: any) => this.payments = (res || []) as Payment[],
      error: () => toast.error('Error al cargar métodos de pago.'),
      complete: () => this.spinner.hide()
    });
  }

  // ------------------ Cliente ------------------
  onCustomerSelected(value: string | null) {
    if (!value) { this.selectedCustomer = null; return; }
    console.log('Valor seleccionado del cliente:', value);
    this.selectedCustomer = this.customers.find((c:any) => c === value) || null;
    console.log('Cliente seleccionado:', this.selectedCustomer);
  }

  saveCustomer(): void {
    this.submittedCustomerForm = true;
    if (this.customerForm.invalid) {
      toast.error('Formulario de cliente inválido.');
      return;
    }
    this.spinner.show();
    const payload = this.customerForm.getRawValue();
    this.customersService.create(payload)
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: (res: any) => {

          const created: Customer = res.message.data;
          toast.success('Cliente creado exitosamente.');
          // añade a la lista y selecciona de inmediato
          this.customers = [created, ...this.customers];
          this.selectedCustomer = created;
          this.invoiceForm.patchValue({ selectedCustomer: created.name });
          this.closeCustomerModal();
        }
      });


  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
    this.submittedCustomerForm = false;
    this.customerForm.reset({ tipo_identificacion: '05 - Cedula' });
  }

  // ------------------ Carrito ------------------
  addProductToCart(product: Product | null): void {
    if (!product) return;

    const existing = this.cartItems.find(ci => ci.name === product.name);
    if (existing) {
      existing.quantity = this.safeNumber(existing.quantity, 0) + 1;
    } else {
      const price = this.safeMoney(product.precio);
      // Inferir tax_value si no viene
      const inferredTaxValue = product.tax_value ?? (product.tax === 'IVA-15' ? 15 : 0);

      this.cartItems.push({
        name: product.name,
        nombre: product.nombre,
        codigo: product.codigo,
        price,
        quantity: 1,
        discount_pct: 0,
        tax: product.tax ?? product.tax_id ?? null, // sigues mandando el ID al backend
        tax_value: inferredTaxValue,                 // % numérico (0 o 15)
        total: price
      });
    }
    this.updateCartTotals();
    this.invoiceForm.patchValue({ selectedProduct: null });
  }


  addAdHocLine(): void {
    const desc = (this.adHoc.description || '').trim();
    if (!desc) return;
    this.cartItems.push({
      description: desc,
      nombre: desc,
      price: 0,
      quantity: 1,
      discount_pct: 0,
      tax: null, // ad-hoc por defecto sin IVA; cámbialo si quieres 'IVA-15'
      total: 0
    });
    this.adHoc.description = '';
    this.updateCartTotals();
  }

  removeProductFromCart(index: number): void {
    if (index < 0 || index >= this.cartItems.length) return;
    this.cartItems.splice(index, 1);
    this.updateCartTotals();
  }

  incrementQty(i: number) {
    const it = this.cartItems[i];
    it.quantity = this.safeNumber(it.quantity, 0) + 1;
    this.updateCartTotals();
  }

  decrementQty(i: number) {
    const it = this.cartItems[i];
    it.quantity = Math.max(1, this.safeNumber(it.quantity, 1) - 1);
    this.updateCartTotals();
  }

  updateCartTotals(): void {
    this.cartItems.forEach(it => {
      const qty = Math.max(1, this.safeNumber(it.quantity, 1));
      const rate = Math.max(0, this.safeMoney(it.price));
      const disc = Math.min(100, Math.max(0, this.safeNumber(it.discount_pct, 0)));
      const lineSubtotal = qty * rate * (1 - disc / 100);
      it.quantity = qty;
      it.price = rate;
      it.discount_pct = disc;
      it.total = this.round2(lineSubtotal);
    });
  }

  // ------------------ Totales ------------------
  get subtotal(): number {
    return this.round2(this.cartItems.reduce((acc, it) => acc + it.total, 0));
  }

  get iva(): number {
    return this.round2(this.cartItems.reduce((acc, it) => {
      const pct = this.getTaxPct(it);
      return acc + it.total * pct; // 'total' es el subtotal de la línea sin IVA
    }, 0));
  }

  get total(): number {
    return this.round2(this.subtotal + this.iva);
  }


  // ------------------ Factura ------------------
  finalizeInvoice(): void {
    if (this.invoiceForm.invalid) {
      toast.error('Selecciona un cliente y verifica los campos.');
      return;
    }
    if (this.cartItems.length === 0) {
      toast.error('Agrega al menos un producto a la factura.');
      return;
    }

    const TYPE_IDENTIFICATION_RUC = '07 - Consumidor Final';
    const UMBRAL = 50;
    const isConsumidorFinal = this.selectedCustomer?.tipo_identificacion === TYPE_IDENTIFICATION_RUC;
    const total = Number(this.total);
    if (isConsumidorFinal && total >= UMBRAL) {
      toast.error(`El consumidor final no puede facturar por un monto mayor o igual a $${UMBRAL}.`);
      return;
    }

    const customerName: string = this.invoiceForm.get('selectedCustomer')?.value;
    const paymentCode: string = this.invoiceForm.get('paymentMethod')?.value;
    const payment = this.payments.find(p => p.codigo === paymentCode);

    // payload para SalesInvoice
    const payload = {
      customer: customerName,
      posting_date: this.invoiceForm.get('postingDate')?.value,
      items: this.cartItems.map(it => ({
        item_code: it.name || 'ADHOC',
        item_name: it.nombre || it.description,
        qty: it.quantity,
        rate: this.round2(it.price),
        tax_rate: Number.isFinite(it.tax_value as number)
          ? (it.tax_value as number)
          : (it.tax === 'IVA-15' ? 15 : 0)
      })),
      payment: payment ? { code: payment.codigo, name: payment.name, amount: total } : null,
      auto_queue: true // 👈 firma+envío por el microservicio
    };

    this.alertService.confirm('¿Deseas emitir la factura?', 'Esta acción creará un documento legal.')
      .then(result => {
        if (!result.isConfirmed) return;

        this.spinner.show();
        this.invoicesService.createFromUI(payload)
          .pipe(finalize(() => this.spinner.hide()))
          .subscribe({
            next: (res) => {
              const inv = res?.message.invoice;
              toast.success(`Factura ${inv} creada y enviada al SRI.`);
              this.clearInvoiceForm();
              // opcional: imprime
              // this.printInvoice(inv);
            }
          });
      });
  }

  private printInvoice(invoiceId: string): void {
    if (!invoiceId) return;
    const invoiceUrl = this.printService.getOrderPdf(invoiceId);
    window.open(invoiceUrl, '_blank', 'noopener=yes,noreferrer=yes');
  }

  private clearInvoiceForm(): void {
    this.invoiceForm.reset({ paymentMethod: '01', selectedCustomer: null, alias: '', postingDate: this.utilsService.getSoloFechaEcuador() });
    this.cartItems = [];
    this.selectedCustomer = null;
  }

  // ------------------ Utilidades ------------------
  trackByIndex = (i: number) => i;

  toUpper(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const value = el.value?.toUpperCase() ?? '';
    this.customerForm.get('nombre')?.setValue(value, { emitEvent: false });
  }

  identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.customerForm?.get('tipo_identificacion')?.value;
      const valor = control.value;
      if (!valor) return null;
      const tipoId = (tipo || '').slice(0, 2);
      if (tipoId === '05' && valor?.length !== 10) { return { cedulaInvalida: true }; }
      if (tipoId === '04' && valor?.length !== 13) { return { rucInvalido: true }; }
      return null;
    };
  }

  getMaxLength(): number {
    const tipo = this.customerForm?.get('tipo_identificacion')?.value;
    return (tipo || '').slice(0, 2) === '05' ? 10 : 13;
  }

  private getErrorMessage(err: any): string {
    if (err?.error?._server_messages) {
      try {
        const messages = JSON.parse(err.error._server_messages);
        return JSON.parse(messages[0]).message.replace(/<[^>]*>?/gm, '');
      } catch {
        return 'Ocurrió un error al procesar la respuesta del servidor.';
      }
    }
    return err?.error?.message || 'Error desconocido.';
  }

  private safeNumber(v: any, def = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  private safeMoney(v: any): number {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? this.round2(n) : 0;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // ad-hoc helper
  adHoc = { description: '' };

  private getTaxPct(it: CartItem): number {
    // Prioriza tax_value numérico (0 o 15); si no existe, compatibilidad con 'IVA-15'
    if (Number.isFinite(it.tax_value as number)) {
      return Math.max(0, (it.tax_value as number) / 100); // 15 -> 0.15
    }
    return it.tax === 'IVA-15' ? 0.15 : 0;
  }


}

