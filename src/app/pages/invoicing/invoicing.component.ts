import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { catchError, debounceTime, distinctUntilChanged, finalize, firstValueFrom, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';

import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { AlertService } from '../../core/services/alert.service';
import { CustomersService } from 'src/app/services/customers.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { ProductsService } from 'src/app/services/products.service';
import { PrintService } from 'src/app/services/print.service';
import { Product } from '../../core/models/product';
import { InvoicesService } from 'src/app/services/invoices.service';
import { UtilsService } from '../../core/services/utils.service';
import { Customer } from 'src/app/core/models/customer';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { ActivatedRoute, Router } from '@angular/router';
import { canSellProduct, canUseInventoryQuantity, getAvailableStock, getInventoryUnit, hasInventoryControl, isLowStockProduct, isOutOfStockProduct, toInventoryNumber } from 'src/app/shared/utils/inventory.utils';
import { AdditionalFieldPayload, normalizeAdditionalFields } from 'src/app/core/models/additional-field';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { buildSinglePaymentPayload, findPaymentMethod, getDefaultPaymentValue } from 'src/app/shared/utils/payment.utils';

type Payment = { name: string; codigo: string; nombre: string; description?: string; };
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
  customerSearchTerm = '';
  isCustomerSearchOpen = false;
  customerSearchLoading = false;
  productSearchTerm = '';
  isProductSearchOpen = false;
  showManualItem = false;
  productSuggestions: Product[] = [];
  cartItems: CartItem[] = [];
  showCustomerModal = false;
  submittedCustomerForm = false;
  ambiente: string = '';
  private subscriptions: Subscription[] = [];
  private readonly customerSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  order: any | null = null;

  get additionalFields(): FormArray {
    return this.invoiceForm.get('additional_fields') as FormArray;
  }

  constructor(
    private customersService: CustomersService,
    private productsService: ProductsService,
    private paymentsService: PaymentsService,
    private printService: PrintService,
    private spinner: NgxSpinnerService,
    private alertService: AlertService,
    private fb: FormBuilder,
    private invoicesService: InvoicesService,
    private utilsService: UtilsService,
    private route: ActivatedRoute,
    private router: Router,
    private capabilities: CompanyCapabilitiesService

  ) { }

  ngOnInit(): void {

    const ambienteGuardado = localStorage.getItem('ambiente');
    console.log('📦ambienteGuardado', ambienteGuardado);
    this.ambiente = ambienteGuardado ?? '----------';
    this.initializeForms();
    this.initCustomerSearch();
    this.loadInitialData();
    const orderName = this.route.snapshot.paramMap.get('order_name');
    console.log('📦orderName', orderName);

    if (orderName) {
      this.getOrderDetail(orderName);

    }

  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.destroy$.next();
    this.destroy$.complete();
  }

  async getOrderDetail(orderName: string) {

    try {
      const response: any = await firstValueFrom(this.invoicesService.getOrderDetail(orderName));

      this.order = response?.message?.data || response?.data;
      console.log('📦order', this.order);
      this.loadOrderData(this.order);

    } catch (error) {
      console.error(error)
    }
  }

  private loadOrderData(order: any): void {
    console.log('loadOrderData', order);
    if (!order) return;

    // 🧾 Cargar datos del cliente
    const c = order.customer || {};
    console.log('c', c);

    this.customerForm.patchValue({
      nombre: c.fullName || c.nombre || '',
      num_identificacion: c.num_identificacion || '',
      tipo_identificacion: this.detectarTipoIdentificacion(c.num_identificacion),
      correo: c.correo || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
    }, { emitEvent: false });

    this.selectedCustomer = { ...this.customerForm.getRawValue(), name: c.name || '' };
    this.customerSearchTerm = this.formatCustomerSearchLabel(this.selectedCustomer);
    console.log('this.selectedCustomer', this.selectedCustomer);

    // 💳 Cargar datos de la factura
    this.invoiceForm.patchValue({
      selectedCustomer: c.name || null,
      alias: order.name || '',
      postingDate: this.utilsService.getSoloFechaEcuador(),
      paymentMethod: this.defaultPaymentMethodValue
    });

    // 🛒 Cargar productos en una variable local (para renderizar en la tabla)
    this.cartItems = order.items.map((it: any) => ({
      name: it.productId,                  // clave del producto en Frappe
      nombre: it.productName,              // nombre legible
      codigo: it.productId,                // si manejas código interno
      price: it.price,
      quantity: it.quantity,
      discount_pct: 0,                     // si no aplica descuento
      tax: null,                           // no necesitas el ID, ya viene el valor
      tax_value: it.tax_rate ?? 0,         // porcentaje IVA
      subtotal: it.subtotal,
      iva: it.iva,
      total: it.total
    }));

    this.updateCartTotals();

    const orderAdditionalFields = normalizeAdditionalFields(
      order.additionalFields ?? order.additional_fields
    );
    orderAdditionalFields.forEach(field => this.addAdditionalField(field));
  }
  private detectarTipoIdentificacion(id: string): string {
    if (!id) return '05 - Cedula';
    if (id === '9999999999999') return '07 - Consumidor Final';
    if (id.length === 10) return '05 - Cedula';
    if (id.length === 13) return '04 - RUC';
    return '05 - Cedula';
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
      paymentMethod: ['', Validators.required],
      alias: [''],
      postingDate: [this.utilsService.getSoloFechaEcuador(), Validators.required], // YYYY-MM-DD, Validators.required],
      additional_fields: this.fb.array([]),
      // company: [null, Validators.required], // <-- descomenta si usas el select de compañía
    });

    const sub = this.customerForm.get('tipo_identificacion')?.valueChanges.subscribe(() => {
      this.customerForm.get('num_identificacion')?.reset();
    });
    if (sub) this.subscriptions.push(sub);
  }

  addAdditionalField(field?: Partial<AdditionalFieldPayload>): void {
    this.additionalFields.push(this.fb.group({
      field_name: [field?.field_name || '', [Validators.required, Validators.maxLength(300)]],
      field_value: [field?.field_value || '', [Validators.required, Validators.maxLength(300)]]
    }));
  }

  removeAdditionalField(index: number): void {
    this.additionalFields.removeAt(index);
  }

  private loadInitialData(): void {
    this.loadProducts();
    this.loadPaymentMethods();
  }

  loadProducts(): void {
    this.spinner.show();
    this.productsService.getAll(1).subscribe({
      next: (res: any) => {
        const all = (res.message.data || []) as Product[];
        this.products = all.filter(p => Number((p as any).isactive) === 1);
        this.refreshProductSuggestions();
        console.log('Productos cargados:', this.products);
      },
      error: () => toast.error('Error al cargar la lista de productos.'),
      complete: () => this.spinner.hide()
    });
  }

  loadPaymentMethods(): void {
    this.spinner.show();
    this.paymentsService.getAll().subscribe({
      next: (res: any) => {
        this.payments = ((res || []) as Payment[]).map(payment => ({
          ...payment,
          name: payment.name || payment.codigo,
          description: payment.description || payment.nombre || payment.name || payment.codigo
        }));
        this.ensureValidPaymentMethod();
        console.log('Metodos de pago cargados:', this.payments);
      },
      error: () => toast.error('Error al cargar métodos de pago.'),
      complete: () => this.spinner.hide()
    });

  }

  get defaultPaymentMethodValue(): string {
    return getDefaultPaymentValue(this.payments);
  }

  private ensureValidPaymentMethod(): void {
    const control = this.invoiceForm?.get('paymentMethod');
    if (!control) return;

    const currentValue = String(control.value || '').trim();
    const selected = findPaymentMethod(this.payments, currentValue);
    const normalizedValue = selected?.name || selected?.codigo || this.defaultPaymentMethodValue;

    if (normalizedValue && normalizedValue !== currentValue) {
      control.patchValue(normalizedValue, { emitEvent: false });
    }
  }

  // ------------------ Cliente ------------------
  onCustomerSearchChange(term: string): void {
    this.customerSearchTerm = term || '';
    if (this.customerSearchTerm.trim().length < 2) {
      this.customers = [];
      this.customerSearchLoading = false;
    }
    this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    this.customerSearch$.next(this.customerSearchTerm);
  }

  openCustomerSearch(): void {
    this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    if (this.isCustomerSearchOpen && this.customers.length === 0) {
      this.customerSearch$.next(this.customerSearchTerm);
    }
  }

  closeCustomerSearchSoon(): void {
    setTimeout(() => {
      this.isCustomerSearchOpen = false;
    }, 150);
  }

  searchCustomerFromInput(): void {
    const term = this.customerSearchTerm.trim();
    if (!term) {
      toast.warning('Escribe nombre, cedula, RUC, telefono o correo del cliente.');
      return;
    }

    if (this.customers.length === 1) {
      this.selectCustomer(this.customers[0]);
      return;
    }

    const digits = term.replace(/\D/g, '');
    if ((digits.length === 10 || digits.length === 13) && digits === term) {
      this.findCustomerByIdentification(digits);
      return;
    }

    if (this.customers.length > 1) {
      this.isCustomerSearchOpen = true;
      return;
    }

    this.searchCustomerSuggestionsNow(term);
  }

  selectFirstCustomerSuggestion(): void {
    if (this.customers.length) {
      this.selectCustomer(this.customers[0]);
      return;
    }
    this.searchCustomerFromInput();
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.invoiceForm.patchValue({ selectedCustomer: customer?.name || null });
    this.customerSearchTerm = this.formatCustomerSearchLabel(customer);
    this.customers = [];
    this.isCustomerSearchOpen = false;
  }

  clearSelectedCustomer(): void {
    this.selectedCustomer = null;
    this.customerSearchTerm = '';
    this.customers = [];
    this.isCustomerSearchOpen = false;
    this.invoiceForm.patchValue({ selectedCustomer: null });
  }

  selectFinalConsumer(): void {
    const finalConsumerIdentification = '9999999999999';
    this.customerSearchTerm = finalConsumerIdentification;
    this.findCustomerByIdentification(finalConsumerIdentification);
  }

  openCustomerModalFromSearch(): void {
    const digits = this.customerSearchTerm.trim().replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 13) {
      this.customerForm.patchValue({
        num_identificacion: digits,
        tipo_identificacion: digits.length === 10 ? '05 - Cedula' : '04 - RUC'
      }, { emitEvent: false });
      this.customerForm.get('num_identificacion')?.updateValueAndValidity();
    }
    this.showCustomerModal = true;
    this.isCustomerSearchOpen = false;
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
          this.selectCustomer(created);
          this.closeCustomerModal();
        }
      });


  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
    this.submittedCustomerForm = false;
    this.customerForm.reset({ tipo_identificacion: '05 - Cedula' });
  }

  private searchCustomerSuggestionsNow(term: string): void {
    if (term.trim().length < 2) {
      toast.warning('Escribe al menos 2 caracteres para buscar.');
      return;
    }

    this.customerSearchLoading = true;
    this.customersService.searchClientes(term, 8).pipe(
      finalize(() => this.customerSearchLoading = false),
      catchError(() => of([]))
    ).subscribe((customers: any[]) => {
      this.customers = customers as Customer[];
      if (customers.length === 1) {
        this.selectCustomer(customers[0] as Customer);
        return;
      }
      if (customers.length > 1) {
        this.isCustomerSearchOpen = true;
        return;
      }
      this.isCustomerSearchOpen = true;
      toast.info('No hay coincidencias. Si es cliente nuevo, usa el boton Nuevo.');
    });
  }

  private findCustomerByIdentification(identification: string): void {
    this.spinner.show();
    this.customersService.get_cliente_by_identificacion(identification).pipe(
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (res: any) => {
        const customer = res?.message || null;
        if (customer) {
          this.selectCustomer(customer);
          return;
        }
        this.openCustomerCreateFromIdentification(identification);
      },
      error: () => {
        this.openCustomerCreateFromIdentification(identification);
      }
    });
  }

  private initCustomerSearch(): void {
    this.customerSearch$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((term: string) => {
        const query = term.trim();
        if (query.length < 2) {
          return of([]);
        }
        this.customerSearchLoading = true;
        return this.customersService.searchClientes(query, 8).pipe(
          catchError(() => of([])),
          finalize(() => this.customerSearchLoading = false)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((customers: any[]) => {
      this.customers = customers as Customer[];
      this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    });
  }

  private openCustomerCreateFromIdentification(identification: string): void {
    this.customerForm.patchValue({
      num_identificacion: identification,
      tipo_identificacion: identification.length === 10 ? '05 - Cedula' : '04 - RUC'
    }, { emitEvent: false });
    this.customerForm.get('num_identificacion')?.updateValueAndValidity();
    this.showCustomerModal = true;
    toast.error('Cliente no encontrado con esa identificacion.');
  }

  private formatCustomerSearchLabel(customer: Partial<Customer> | null | undefined): string {
    const name = customer?.nombre || 'Cliente';
    const identification = customer?.num_identificacion ? ` - ${customer.num_identificacion}` : '';
    return `${name}${identification}`;
  }

  // ------------------ Carrito ------------------
  onProductSearchChange(term: string): void {
    this.productSearchTerm = term || '';
    this.refreshProductSuggestions();
    this.isProductSearchOpen = !this.order;
  }

  openProductSearch(): void {
    if (this.order) return;
    this.refreshProductSuggestions();
    this.isProductSearchOpen = true;
  }

  closeProductSearchSoon(): void {
    setTimeout(() => {
      this.isProductSearchOpen = false;
    }, 150);
  }

  selectProductFromSearch(product: Product): void {
    if (!product) return;
    this.addProductToCart(product);
    this.productSearchTerm = '';
    this.isProductSearchOpen = false;
  }

  selectFirstProductSuggestion(): void {
    const firstAvailable = this.filteredProductSuggestions.find(product => !this.isProductBlocked(product));
    if (!firstAvailable) {
      toast.info(this.productSearchTerm.trim() ? 'No hay productos disponibles para agregar.' : 'Escribe o selecciona un producto.');
      return;
    }

    this.selectProductFromSearch(firstAvailable);
  }

  clearProductSearch(): void {
    this.productSearchTerm = '';
    this.refreshProductSuggestions();
    this.isProductSearchOpen = false;
    this.invoiceForm.patchValue({ selectedProduct: null });
  }

  addProductToCart(productSelection: Product | string | null): void {
    const product = this.resolveProduct(productSelection);
    if (!product) return;
    if (this.isProductBlocked(product)) {
      toast.warning('Este producto esta agotado y no se puede agregar.');
      this.invoiceForm.patchValue({ selectedProduct: null });
      return;
    }

    const existing = this.cartItems.find(ci => ci.name === product.name);
    if (existing) {
      const nextQuantity = this.safeNumber(existing.quantity, 0) + 1;
      if (!canUseInventoryQuantity(product, nextQuantity)) {
        toast.warning(`Stock disponible: ${this.getInventoryLabel(product)}.`);
        this.invoiceForm.patchValue({ selectedProduct: null });
        return;
      }
      existing.quantity = nextQuantity;
    } else {
      if (!canUseInventoryQuantity(product, 1)) {
        toast.warning(`Stock disponible: ${this.getInventoryLabel(product)}.`);
        this.invoiceForm.patchValue({ selectedProduct: null });
        return;
      }
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
    this.showManualItem = false;
    this.updateCartTotals();
  }

  removeProductFromCart(index: number): void {
    if (index < 0 || index >= this.cartItems.length) return;
    this.cartItems.splice(index, 1);
    this.updateCartTotals();
  }

  incrementQty(i: number) {
    const it = this.cartItems[i];
    const nextQuantity = this.safeNumber(it.quantity, 0) + 1;
    if (!this.canUseCartQuantity(it, nextQuantity)) {
      toast.warning(`No puedes superar el stock disponible: ${this.getCartStockLabel(it)}.`);
      return;
    }
    it.quantity = nextQuantity;
    this.updateCartTotals();
  }

  decrementQty(i: number) {
    const it = this.cartItems[i];
    it.quantity = Math.max(1, this.safeNumber(it.quantity, 1) - 1);
    this.updateCartTotals();
  }

  onCartQuantityChange(index: number): void {
    const item = this.cartItems[index];
    if (!item) return;

    const requestedQuantity = Math.max(1, this.safeNumber(item.quantity, 1));
    const product = this.getCartProduct(item);

    if (product && !canUseInventoryQuantity(product, requestedQuantity)) {
      const availableStock = Math.max(1, getAvailableStock(product));
      item.quantity = availableStock;
      toast.warning(`Cantidad ajustada al stock disponible: ${this.getInventoryLabel(product)}.`);
    } else {
      item.quantity = requestedQuantity;
    }

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
    const planBlockMessage = this.capabilities.getPlanBlockMessage('direct_invoice');
    if (planBlockMessage) {
      toast.error(planBlockMessage);
      return;
    }

    console.log('selectedCustomer', this.selectedCustomer);
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      toast.error('Selecciona un cliente y verifica los campos.');
      return;
    }
    if (this.cartItems.length === 0) {
      toast.error('Agrega al menos un producto a la factura.');
      return;
    }
    const stockBlockedItem = this.cartItems.find(item => !this.canUseCartQuantity(item, this.safeNumber(item.quantity, 1)));
    if (stockBlockedItem) {
      toast.error(`Stock insuficiente para ${stockBlockedItem.nombre || stockBlockedItem.description}. Disponible: ${this.getCartStockLabel(stockBlockedItem)}.`);
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
    const paymentValue: string = this.invoiceForm.get('paymentMethod')?.value;
    const paymentResult = buildSinglePaymentPayload(this.payments, paymentValue, total);
    if (paymentResult.error) {
      toast.error(paymentResult.error);
      return;
    }

    // payload para SalesInvoice
    const payload = {
      customer: customerName,
      total: total,
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
      payments: paymentResult.payments,
      auto_queue: true, // 👈 firma+envío por el microservicio
      order_name: this.order?.name,
      additional_fields: this.canUseAdditionalFields ? normalizeAdditionalFields(this.additionalFields.getRawValue()) : []
    };

    console.log('payload', payload);

    this.alertService.confirm('¿Deseas emitir la factura?', 'Esta acción creará un documento legal.')
      .then(result => {
        if (!result.isConfirmed) return;

        this.spinner.show();
        this.invoicesService.create_and_emit_from_ui_v2(payload)
          .pipe(finalize(() => this.spinner.hide()))
          .subscribe({
            next: (res) => {
              console.log('res save invoce',res);
              const inv = res?.message.invoice;
              toast.success(`Factura ${inv} creada y enviada al SRI.`);
              this.clearInvoiceForm();

              this.alertService.confirm(`Factura ${inv} creada y enviada al SRI.`, '¿Deseas imprimir la factura?', 'success')
                .then(result => {
                  if (result.isConfirmed) this.printInvoice(inv);
                  if (this.order) {
                    this.router.navigate(['/dashboard/invoicing']);
                  }
                });

            },error: (err: any) => {
              console.error('Error al emitir factura:', err);
            }
          });
      });
  }

  get canEmitInvoice(): boolean {
    return this.capabilities.validateFeatureUse('direct_invoice').allowed;
  }

  get invoicePlanBlockMessage(): string | null {
    return this.capabilities.getPlanBlockMessage('direct_invoice');
  }

  get canUseAdditionalFields(): boolean {
    return this.capabilities.isEnabled('additional_fields');
  }

  private printInvoice(invoiceId: string): void {
    if (!invoiceId) return;
    const invoiceUrl = this.printService.getFacturaPdf(invoiceId);
    window.open(invoiceUrl, '_blank', 'noopener=yes,noreferrer=yes');
  }

  private clearInvoiceForm(): void {
    this.invoiceForm.reset({ paymentMethod: this.defaultPaymentMethodValue, selectedCustomer: null, alias: '', postingDate: this.utilsService.getSoloFechaEcuador() });
    this.cartItems = [];
    this.productSearchTerm = '';
    this.productSuggestions = [];
    this.isProductSearchOpen = false;
    this.showManualItem = false;
    this.adHoc.description = '';
    this.additionalFields.clear();
    this.clearSelectedCustomer();
  }

  // ------------------ Utilidades ------------------
  trackByIndex = (i: number) => i;
  trackByCustomerId = (_: number, c: Customer) => c?.name || c?.num_identificacion || _;
  trackByProductId = (_: number, product: Product) => product?.name || product?.codigo || _;

  get filteredProductSuggestions(): Product[] {
    return this.productSuggestions;
  }

  get productSearchHelpText(): string {
    if (!this.products.length) return 'Cargando productos...';
    if (!this.productSearchTerm.trim()) return 'Productos recientes/disponibles para agregar rápido.';
    return `${this.filteredProductSuggestions.length} coincidencia(s).`;
  }

  getProductPriceLabel(product: Product | null | undefined): string {
    return `$${this.safeMoney((product as any)?.precio).toFixed(2)}`;
  }

  getProductTaxLabel(product: Product | null | undefined): string {
    const tax = (product as any)?.tax_value ?? ((product as any)?.tax === 'IVA-15' ? 15 : 0);
    return `${tax || 0}% IVA`;
  }

  canIncreaseCartItem(index: number): boolean {
    const item = this.cartItems[index];
    if (!item) return false;
    return this.canUseCartQuantity(item, this.safeNumber(item.quantity, 0) + 1);
  }

  getCartStockLabel(item: CartItem): string {
    const product = this.getCartProduct(item);
    if (!product || !this.hasInventory(product)) return 'Sin control';
    return this.getInventoryLabel(product);
  }

  hasCartInventory(item: CartItem): boolean {
    return this.hasInventory(this.getCartProduct(item));
  }

  hasInventory(product: Product | null | undefined): boolean {
    return hasInventoryControl(product);
  }

  isLowStock(product: Product | null | undefined): boolean {
    return isLowStockProduct(product);
  }

  isOutOfStock(product: Product | null | undefined): boolean {
    return isOutOfStockProduct(product);
  }

  isProductBlocked(product: Product | null | undefined): boolean {
    return !canSellProduct(product);
  }

  getInventoryLabel(product: Product | null | undefined): string {
    if (!this.hasInventory(product)) {
      return 'Sin control';
    }

    return `${toInventoryNumber(product?.stock_actual, 0)} ${getInventoryUnit(product)}`;
  }

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

  private resolveProduct(productSelection: Product | string | null): Product | null {
    if (!productSelection) return null;
    if (typeof productSelection !== 'string') return productSelection;
    return this.products.find((item) => item.name === productSelection) || null;
  }

  private getCartProduct(item: CartItem): Product | null {
    if (!item?.name || item.name === 'ADHOC') return null;
    return this.products.find(product => product.name === item.name) || null;
  }

  private canUseCartQuantity(item: CartItem, quantity: number): boolean {
    const product = this.getCartProduct(item);
    return canUseInventoryQuantity(product, quantity);
  }

  private refreshProductSuggestions(): void {
    const query = this.normalizeSearch(this.productSearchTerm);
    const source = this.products || [];

    if (!query) {
      this.productSuggestions = source.slice(0, 8);
      return;
    }

    this.productSuggestions = source
      .map(product => ({ product, score: this.getProductSearchScore(product, query) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(entry => entry.product);
  }

  private normalizeSearch(value: any): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getProductSearchScore(product: Product, query: string): number {
    const name = this.normalizeSearch((product as any)?.nombre);
    const code = this.normalizeSearch((product as any)?.codigo);
    const description = this.normalizeSearch((product as any)?.descripcion);
    const haystack = `${name} ${code} ${description}`;
    const tokens = query.split(/\s+/).filter(Boolean);

    if (!tokens.every(token => haystack.includes(token))) return 0;
    if (code === query || name === query) return 100;
    if (code.startsWith(query)) return 90;
    if (name.startsWith(query)) return 80;
    if (code.includes(query)) return 70;
    if (name.includes(query)) return 60;
    return 40;
  }


}

