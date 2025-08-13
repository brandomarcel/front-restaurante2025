import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { Subscription } from 'rxjs';

import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { AlertService } from '../../core/services/alert.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { ProductsService } from 'src/app/services/products.service';
import { PrintService } from 'src/app/services/print.service';

type Customer = { name: string; nombre: string; num_identificacion?: string; correo?: string; };
type Product  = { name: string; nombre: string; precio: number | string; tax?: string; tax_code?: string; codigo?: string; isactive?: number; };
type Payment  = { name: string; codigo: string; nombre: string; };
type CartItem = {
  name?: string; nombre?: string; description?: string; codigo?: string;
  quantity: number; price: number; discount_pct: number; tax?: string | null; total: number;
};

@Component({
  selector: 'app-invoicing',
  standalone: true,
  imports: [ CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, ButtonComponent ],
  templateUrl: './invoicing.component.html',
  styleUrls: ['./invoicing.component.css']
})
export class InvoicingComponent implements OnInit, OnDestroy {
  // --- Formularios ---
  invoiceForm!: FormGroup;
  customerForm!: FormGroup;

  // --- Datos ---
  customers: Customer[] = [];
  products: Product[] = [];
  payments: Payment[] = [];

  // --- Estado UI ---
  selectedCustomer: Customer | null = null;
  cartItems: CartItem[] = [];
  showCustomerModal = false;
  submittedCustomerForm = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private customersService: CustomersService,
    private productsService: ProductsService,
    private paymentsService: PaymentsService,
    private ordersService: OrdersService,
    private printService: PrintService,
    private spinner: NgxSpinnerService,
    private alertService: AlertService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
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
    tipo_identificacion: ['05 - Cédula', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', Validators.required],
    direccion: ['', Validators.required],
  });

  this.invoiceForm = this.fb.group({
    selectedCustomer: [null, Validators.required],
    paymentMethod: ['01', Validators.required],
    alias: [''],
    postingDate: [this.todayISO(), Validators.required],
    // company: [null, Validators.required], // <-- descomenta si usas el select de compañía
  });

  const sub = this.customerForm.get('tipo_identificacion')?.valueChanges.subscribe(() => {
    this.customerForm.get('num_identificacion')?.reset();
  });
  if (sub) this.subscriptions.push(sub);
}

private todayISO(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' para <input type="date">
}

  private loadInitialData(): void {
    this.loadCustomers();
    this.loadProducts();
    this.loadPaymentMethods();
  }

  // ------------------ Carga de datos ------------------
  loadCustomers(): void {
    this.spinner.show();
    this.customersService.getAll().subscribe({
      next: (res: any) => this.customers = (res?.data || []) as Customer[],
      error: () => toast.error('Error al cargar la lista de clientes.'),
      complete: () => this.spinner.hide()
    });
  }

  loadProducts(): void {
    this.spinner.show();
    this.productsService.getAll().subscribe({
      next: (res: any) => {
        const all = (res?.data || []) as Product[];
        this.products = all.filter(p => Number((p as any).isactive) === 1);
      },
      error: () => toast.error('Error al cargar la lista de productos.'),
      complete: () => this.spinner.hide()
    });
  }

  loadPaymentMethods(): void {
    this.spinner.show();
    this.paymentsService.getAll().subscribe({
      next: (res: any) => this.payments = (res?.data || []) as Payment[],
      error: () => toast.error('Error al cargar métodos de pago.'),
      complete: () => this.spinner.hide()
    });
  }

  // ------------------ Cliente ------------------
  onCustomerSelected(value: string) {
    // value = name (por bindValue="name" en ng-select)
    this.selectedCustomer = this.customers.find(c => c.name === value) || null;
    // opcional: ya que el control tiene el value, no hace falta setear de nuevo
  }

  saveCustomer(): void {
    this.submittedCustomerForm = true;
    if (this.customerForm.invalid) {
      toast.error('Formulario de cliente inválido.');
      return;
    }
    this.spinner.show();
    const payload = this.customerForm.getRawValue();
    this.customersService.create(payload).subscribe({
      next: (res: any) => {
        const created: Customer = res?.data;
        toast.success('Cliente creado exitosamente.');
        // añade a la lista y selecciona de inmediato
        this.customers = [created, ...this.customers];
        this.selectedCustomer = created;
        this.invoiceForm.patchValue({ selectedCustomer: created.name });
        this.closeCustomerModal();
      },
      error: (err) => {
        const errorMessage = this.getErrorMessage(err);
        toast.error(`Error al crear cliente: ${errorMessage}`);
        this.spinner.hide();
      },
      complete: () => this.spinner.hide()
    });
  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
    this.submittedCustomerForm = false;
    this.customerForm.reset({ tipo_identificacion: '05 - Cédula' });
  }

  // ------------------ Carrito ------------------
  addProductToCart(product: Product | null): void {
    if (!product) return;
    const existing = this.cartItems.find(ci => ci.name === product.name);
    if (existing) {
      existing.quantity = this.safeNumber(existing.quantity, 0) + 1;
    } else {
      const price = this.safeMoney(product.precio);
      this.cartItems.push({
        name: product.name,
        nombre: product.nombre,
        codigo: product.codigo,
        price,
        quantity: 1,
        discount_pct: 0,
        tax: product.tax ?? product.tax_code ?? null,
        total: price
      });
    }
    this.updateCartTotals();
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
      const qty  = Math.max(1, this.safeNumber(it.quantity, 1));
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
    // IVA por línea si tax === 'IVA-15'
    return this.round2(this.cartItems.reduce((acc, it) => {
      const rate = it.tax === 'IVA-15' ? 0.15 : 0;
      return acc + it.total * rate;
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

    const customerName: string = this.invoiceForm.get('selectedCustomer')?.value;
    const paymentCode: string = this.invoiceForm.get('paymentMethod')?.value;
    const payment = this.payments.find(p => p.codigo === paymentCode);

    const invoiceData = {
      customer: customerName,
      alias: this.invoiceForm.get('alias')?.value,
      estado: 'Factura',
      total: this.total.toFixed(2),
      items: this.cartItems.map(it => ({
        product: it.name || null,      // si es ad-hoc vendrá null
        description: it.description || it.nombre,
        qty: it.quantity,
        rate: this.round2(it.price),
        discount_pct: this.round2(it.discount_pct || 0),
        tax: it.tax || null
      })),
      payments: [{ formas_de_pago: payment?.name }]
    };

    this.alertService.confirm('¿Deseas emitir la factura?', 'Esta acción creará un documento legal.').then(result => {
      if (!result.isConfirmed) return;

      this.spinner.show();
      this.ordersService.create(invoiceData).subscribe({
        next: (res: any) => {
          const id = res?.data?.name;
          toast.success(`Factura #${id} creada exitosamente.`);
          setTimeout(() => this.printInvoice(id), 300);
          this.clearInvoiceForm();
        },
        error: () => toast.error('Error al crear la factura.'),
        complete: () => this.spinner.hide()
      });
    });
  }

  private printInvoice(invoiceId: string): void {
    if (!invoiceId) return;
    const invoiceUrl = this.printService.getOrderPdf(invoiceId);
    window.open(invoiceUrl, '_blank', 'noopener=yes,noreferrer=yes');
  }

  private clearInvoiceForm(): void {
    this.invoiceForm.reset({ paymentMethod: '01', selectedCustomer: null, alias: '' });
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
}
