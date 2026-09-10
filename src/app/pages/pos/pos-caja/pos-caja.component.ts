import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
import { catchError, debounceTime, distinctUntilChanged, finalize, of, Subject, switchMap, takeUntil } from 'rxjs';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { CategoryService } from 'src/app/services/category.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { PosSaleService } from 'src/app/services/pos-sale.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from 'src/environments/environment';
import { CartService } from '../services/cart.service';
import { canSellProduct, getAvailableStock, getInventoryUnit, hasInventoryControl, isLowStockProduct, isOutOfStockProduct, toInventoryNumber } from 'src/app/shared/utils/inventory.utils';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { buildSinglePaymentPayload, findPaymentMethod, getDefaultPaymentValue, getPaymentDisplayLabel, isCashPayment } from 'src/app/shared/utils/payment.utils';
import { liteEmissionMessages, liteEmissionState } from 'src/app/core/utils/lite-invoice-emission';

@Component({
  selector: 'app-pos-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule],
  templateUrl: './pos-caja.component.html',
  styles: [':host { display: block; height: 100%; min-height: 0; }']
})
export class PosCajaComponent implements OnInit, OnDestroy {
  @Input() selectedTableId = '';
  @Input() selectedTableLabel = '';
  ambiente = '';
  showPaymentModal = false;
  showCustomerModal = false;
  showPrintModal = false;
  isSubmittingOrder = false;
  isSubmittingPosSale = false;
  activePosSaleNote: any | null = null;

  amountReceived: number | null = null;
  change = 0;

  products: any[] = [];
  filteredProductList: any[] = [];
  favoriteProducts: any[] = [];
  categories: any[] = [];
  payments: any[] = [];
  filteredCustomers: any[] = [];

  identificationCustomer = '';
  customerSearchTerm = '';
  isCustomerSearchOpen = false;
  customerSearchLoading = false;
  customer: any = null;
  alias = '';
  searchTerm = '';
  selectedCategory = '';
  productView: 'all' | 'favorites' = 'all';
  orderType: 'Servirse' | 'Llevar' | 'Domicilio' = 'Servirse';
  deliveryAddress = '';
  deliveryPhone = '';
  paymentMethod = '';

  printOption: 'comanda' | 'recibo' | 'ambas' = 'ambas';
  private pendingOrderId: string | null = null;
  private pendingInvoiceId: string | null = null;
  printContext: 'order' | 'invoice' = 'order';
  private today = '';
  private readonly url = environment.URL;
  private readonly favoritesStorageKey = 'pos_caja_favorites_v1';
  private readonly customerSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private favoriteProductKeys = new Set<string>();

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
    private posSaleService: PosSaleService,
    private invoicesService: InvoicesService,
    private spinner: NgxSpinnerService,
    private printService: PrintService,
    public cartService: CartService,
    public alertService: AlertService,
    private capabilities: CompanyCapabilitiesService,
    private utilsService: UtilsService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (this.selectedTableLabel && !this.alias) this.alias = this.selectedTableLabel;
    this.ambiente = this.utilsService.getAmbienteActual()
      || localStorage.getItem('ambiente')
      || '---';
    this.utilsService.ambiente$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ambiente) => {
        if (ambiente) this.ambiente = ambiente;
      });
    this.today = this.buildEcuadorIsoDate();
    this.loadFavorites();
    this.initClienteForm();
    this.initCustomerSearch();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    return !!this.customer
      && this.cartService.cart.length > 0
      && !this.isSubmittingOrder
      && (!this.genericMode || !this.posTerminalBlockMessage);
  }

  /** The generic POS intentionally reuses this component's proven product,
   * customer, cart and payment UI, but emits a Lite invoice instead of a
   * restaurant order. */
  get genericMode(): boolean {
    return this.capabilities.isEnabled('generic_pos');
  }

  get canEmitInvoice(): boolean {
    return this.capabilities.canEmit() && !this.capabilities.getPosTerminalBlockMessage();
  }

  get currentFiscalLocation(): any | null {
    return this.capabilities.activeFiscalLocation;
  }

  get terminalAssignmentLabel(): string {
    return this.currentFiscalLocation?.terminal && this.capabilities.terminalAccessRequired ? 'Asignado a tu usuario' : '';
  }

  get posTerminalBlockMessage(): string | null {
    return this.capabilities.getPosTerminalBlockMessage();
  }

  fiscalLocationLabel(location: any): string {
    const establishment = location?.establishment;
    const point = location?.emissionPoint;
    const establishmentCode = establishment?.establishment_code || '—';
    const pointCode = point?.emission_point_code || '—';
    return establishment || point ? `${establishmentCode}-${pointCode}` : 'No configurado';
  }

  get invoicePlanBlockMessage(): string | null {
    return this.capabilities.getPlanBlockMessage(this.genericMode ? 'generic_pos' : 'direct_invoice')
      || this.capabilities.getPosTerminalBlockMessage();
  }

  get visibleProductList(): any[] {
    return this.productView === 'favorites' ? this.favoriteProducts : this.filteredProductList;
  }

  get productViewLabel(): string {
    return this.productView === 'favorites' ? 'favoritos' : 'productos';
  }

  get selectedPaymentName(): string {
    const payment = findPaymentMethod(this.payments, this.paymentMethod);
    return getPaymentDisplayLabel(payment);
  }

  get isSelectedPaymentCash(): boolean {
    return isCashPayment(this.payments, this.paymentMethod);
  }

  toggleSidebar(): void {
    this.menuService.toggleSidebar();
  }

  setOrderType(tipo: 'Servirse' | 'Llevar' | 'Domicilio'): void {
    this.orderType = tipo;
  }

  onPaymentMethodChange(): void {
    if (!this.isSelectedPaymentCash) {
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
        this.products = Array.isArray(res) ? res : (res?.message?.data || []);
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
        this.payments = (res || []).map((payment: any) => ({
          ...payment,
          name: payment.name || payment.codigo,
          description: payment.description || payment.nombre || payment.name || payment.codigo
        }));
        this.ensureValidPaymentMethod();
      },
      error: () => {
        toast.error('Error al cargar metodos de pago.');
      }
    });
  }

  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim() || this.customerSearchTerm?.trim();
    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      toast.warning('La identificacion debe tener 10 o 13 digitos.');
      return;
    }

    this.spinner.show();
    this.customersService.get_cliente_by_identificacion(identification).pipe(
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (res: any) => {
        this.customer = res?.data || res?.message?.data || (res?.message && typeof res.message === 'object' ? res.message : res) || null;
        if (this.customer) {
          this.selectCustomer(this.customer);
          return;
        }
        this.openCustomerCreateFromIdentification(identification);
      },
      error: () => {
        this.customer = null;
        this.openCustomerCreateFromIdentification(identification);
      }
    });
  }

  selectFinalConsumer(): void {
    this.identificationCustomer = '9999999999999';
    this.customerSearchTerm = this.identificationCustomer;
    this.findByIdentificationCustomer();
  }

  onCustomerSearchChange(term: string): void {
    this.customerSearchTerm = term || '';
    const digits = this.customerSearchTerm.replace(/\D/g, '');
    this.identificationCustomer = digits.length === this.customerSearchTerm.trim().length ? digits : '';
    if (this.customerSearchTerm.trim().length < 2) {
      this.filteredCustomers = [];
      this.customerSearchLoading = false;
    }
    this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    this.customerSearch$.next(this.customerSearchTerm);
  }

  openCustomerSearch(): void {
    this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    if (this.isCustomerSearchOpen && this.filteredCustomers.length === 0) {
      this.customerSearch$.next(this.customerSearchTerm);
    }
  }

  closeCustomerSearchSoon(): void {
    setTimeout(() => {
      this.isCustomerSearchOpen = false;
    }, 150);
  }

  openCustomerModalFromSearch(): void {
    const digits = this.customerSearchTerm.trim().replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 13) {
      this.clienteForm.patchValue({
        num_identificacion: digits,
        tipo_identificacion: digits.length === 10 ? '05 - Cedula' : '04 - RUC'
      }, { emitEvent: false });
      this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    }
    this.showCustomerModal = true;
    this.isCustomerSearchOpen = false;
  }

  searchCustomerFromInput(): void {
    const term = this.customerSearchTerm.trim();
    if (!term) {
      toast.warning('Escribe nombre, cedula, RUC, telefono o correo del cliente.');
      return;
    }

    if (this.filteredCustomers.length === 1) {
      this.selectCustomer(this.filteredCustomers[0]);
      return;
    }

    const digits = term.replace(/\D/g, '');
    if ((digits.length === 10 || digits.length === 13) && digits === term) {
      this.identificationCustomer = digits;
      this.findByIdentificationCustomer();
      return;
    }

    if (this.filteredCustomers.length > 1) {
      this.isCustomerSearchOpen = true;
      return;
    }

    this.searchCustomerSuggestionsNow(term);
  }

  selectFirstCustomerSuggestion(): void {
    if (this.filteredCustomers.length) {
      this.selectCustomer(this.filteredCustomers[0]);
      return;
    }
    this.searchCustomerFromInput();
  }

  selectCustomer(customer: any): void {
    this.customer = customer;
    this.identificationCustomer = customer?.num_identificacion || '';
    this.customerSearchTerm = this.formatCustomerSearchLabel(customer);
    this.filteredCustomers = [];
    this.isCustomerSearchOpen = false;
  }

  clearCustomerSelection(): void {
    this.identificationCustomer = '';
    this.customerSearchTerm = '';
    this.customer = null;
    this.filteredCustomers = [];
    this.isCustomerSearchOpen = false;
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
      this.filteredCustomers = customers;
      if (customers.length === 1) {
        this.selectCustomer(customers[0]);
        return;
      }
      if (customers.length > 1) {
        this.isCustomerSearchOpen = true;
        return;
      }
      this.isCustomerSearchOpen = true;
      toast.info('No hay coincidencias. Si es cliente nuevo, usa el boton +.');
    });
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
        this.customer = Array.isArray(res) ? res[0] : (res?.data || res?.message?.data || res?.message || res);
        this.identificationCustomer = this.customer?.num_identificacion || '';
        this.customerSearchTerm = this.formatCustomerSearchLabel(this.customer);
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
    this.sanitizeFavorites();

    const filtered = (this.products || []).filter((product: any) => {
      const prodCat = this.normalize(this.getProductCategoryName(product));
      const okCat = !selectedCat || prodCat === selectedCat;
      if (!term) return okCat;

      const name = this.normalize(product?.nombre ?? product?.name);
      const desc = this.normalize(product?.description ?? product?.descripcion);
      return okCat && (name.includes(term) || desc.includes(term));
    });

    this.filteredProductList = filtered
      .map((product: any, index: number) => ({ product, index }))
      .sort((a, b) => {
        const aOut = this.canAddProduct(a.product) ? 0 : 1;
        const bOut = this.canAddProduct(b.product) ? 0 : 1;
        if (aOut !== bOut) {
          return aOut - bOut;
        }

        const aFav = this.isFavorite(a.product) ? 1 : 0;
        const bFav = this.isFavorite(b.product) ? 1 : 0;
        if (bFav !== aFav) {
          return bFav - aFav;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.product);

    this.syncFavoriteProducts();
  }

  addProduct(product: any): void {
    if (!this.canAddProduct(product)) {
      toast.warning(this.getStockLimitMessage(product));
      return;
    }

    if (!this.cartService.addProduct(product)) {
      toast.warning(this.getStockLimitMessage(product));
    }
  }

  increase(item: any): void {
    if (!this.cartService.increase(item)) {
      toast.warning(this.getStockLimitMessage(item));
    }
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
    if (!this.genericMode && this.orderType === 'Domicilio' && (!this.deliveryAddress.trim() || !this.deliveryPhone.trim())) {
      toast.error('Completa direccion y telefono para pedidos a domicilio.');
      return;
    }

    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = true;
  }

  calcularCambio(): void {
    if (!this.isSelectedPaymentCash) {
      this.change = 0;
      return;
    }
    const recibido = Number(this.amountReceived);
    this.change = Number.isFinite(recibido) ? this.round2(recibido - this.total) : 0;
  }

  confirmarPago(typePago: 'Nota Venta' | 'Factura'): void {
    if (this.isSubmittingOrder || this.isSubmittingPosSale) return;

    if (typePago === 'Factura') {
      const planBlockMessage = this.invoicePlanBlockMessage;
      if (planBlockMessage) {
        toast.error(planBlockMessage);
        return;
      }
    }

    const receivedAmount = Number(this.amountReceived);
    if (this.isSelectedPaymentCash && (!Number.isFinite(receivedAmount) || receivedAmount < this.total)) {
      toast.error('El monto recibido es menor al total.');
      return;
    }

    const TYPE_IDENTIFICATION_CF = '07 - Consumidor Final';
    const UMBRAL = 50;
    const customerType = String(this.customer?.tipo_identificacion || this.customer?.identification_type || '').trim();
    const customerNumber = String(this.customer?.num_identificacion || this.customer?.identification_number || '').trim();
    const isConsumidorFinal = customerType === TYPE_IDENTIFICATION_CF
      || /consumidor final/i.test(customerType)
      || customerNumber === '9999999999999';
    if (isConsumidorFinal && typePago === 'Factura' && this.total > UMBRAL) {
      toast.error(`No se puede emitir una factura a CONSUMIDOR FINAL por un valor superior a USD ${UMBRAL} IVA incluido. Seleccione un cliente identificado.`);
      return;
    }

    if (this.genericMode) {
      const payload = typePago === 'Factura'
        ? this.buildDirectLiteInvoicePayload()
        : this.buildPosSaleNotePayload();
      if (!payload) return;
      const title = typePago === 'Factura' ? '¿Deseas cobrar y facturar esta venta?' : '¿Deseas guardar esta nota de venta?';
      const detail = typePago === 'Factura'
        ? 'Se emitirá directamente una factura electrónica con el cliente y productos actuales.'
        : 'La nota quedará en borrador para cobrarla después.';
      this.alertService.confirm(title, detail).then((result) => {
          if (!result.isConfirmed) return;
          if (typePago === 'Factura') this.submitDirectLiteInvoice(payload);
          else this.submitPosSaleNote(payload);
        });
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
        console.log('res', res);
        toast.success('Orden creada.');
        this.pendingOrderId = res?.message?.name || null;
        this.clearPage();
      }
    });
  }

  openPrintModal(orderId: string): void {
    this.pendingOrderId = orderId;
    this.pendingInvoiceId = null;
    this.printContext = 'order';
    this.showPaymentModal = false;
    this.showPrintModal = true;
  }

  private openInvoicePrintModal(invoiceId: string): void {
    this.pendingInvoiceId = invoiceId;
    this.pendingOrderId = null;
    this.printContext = 'invoice';
    this.showPaymentModal = false;
    this.showPrintModal = true;
  }

  handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas' | 'ticket' | 'skip'): void {
    if (this.printContext === 'invoice') {
      const invoiceId = this.pendingInvoiceId;
      if (!invoiceId) {
        this.finishPrintFlow();
        return;
      }
      if (option === 'ticket') {
        this.printService.downloadLiteInvoiceTicket(invoiceId).subscribe({
          next: (blob) => {
            this.openPdfBlob(blob);
            this.finishPrintFlow();
          },
          error: () => {
            toast.error('El ticket aún no está disponible. Puedes consultarlo desde el detalle de la factura.');
            this.finishPrintFlow();
          }
        });
      } else {
        this.finishPrintFlow();
      }
      return;
    }

    if (!this.pendingOrderId) return;

    if (option === 'comanda') this.openPrintWindow(this.printService.getComanda(this.pendingOrderId));
    if (option === 'recibo') this.openPrintWindow(this.printService.getRecibo(this.pendingOrderId));
    if (option === 'ambas') this.openPrintWindow(this.printService.getOrderPdf(this.pendingOrderId));

  }

  closePrintModal(): void {
    this.finishPrintFlow();
  }

  private finishPrintFlow(): void {
    this.showPrintModal = false;
    const invoiceId = this.pendingInvoiceId;
    this.pendingOrderId = null;
    this.pendingInvoiceId = null;
    this.printContext = 'order';
    this.clearPage();
    if (invoiceId) this.router.navigate(['/dashboard/invoices', invoiceId]);
  }

  onCategorySelected(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  setProductView(view: 'all' | 'favorites'): void {
    this.productView = view;
    this.applyFilters();
  }

  toggleFavorite(product: any): void {
    const key = this.getProductKey(product);
    if (!key) return;
    const alreadyFavorite = this.favoriteProductKeys.has(key);

    if (!alreadyFavorite && !canSellProduct(product)) {
      toast.warning('No puedes marcar como favorito un producto agotado.');
      return;
    }

    if (alreadyFavorite) {
      this.favoriteProductKeys.delete(key);
    } else {
      this.favoriteProductKeys.add(key);
    }

    this.persistFavorites();
    this.applyFilters();
  }

  isFavorite(product: any): boolean {
    const key = this.getProductKey(product);
    return !!key && this.favoriteProductKeys.has(key);
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
    this.customerSearchTerm = '';
    this.filteredCustomers = [];
    this.isCustomerSearchOpen = false;
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
  trackByFavorite = (_: number, p: any) => this.getProductKey(p);
  trackByCustomerId = (_: number, c: any) => c?.name || c?.num_identificacion || _;

  canAddProduct(product: any): boolean {
    return this.cartService.canAddProduct(product);
  }

  canIncreaseItem(item: any): boolean {
    return this.cartService.canIncrease(item);
  }

  hasInventory(product: any): boolean {
    return hasInventoryControl(product);
  }

  isLowStock(product: any): boolean {
    return isLowStockProduct(product);
  }

  isOutOfStock(product: any): boolean {
    return isOutOfStockProduct(product);
  }

  getInventoryLabel(product: any): string {
    if (!this.hasInventory(product)) {
      return 'Sin control';
    }

    return `${toInventoryNumber(product?.stock_actual, 0)} ${getInventoryUnit(product)}`;
  }

  getStockLimitMessage(product: any): string {
    const productName = product?.nombre || product?.name || 'Producto';
    if (!this.hasInventory(product)) {
      return `${productName} no se puede agregar.`;
    }

    if (!canSellProduct(product)) {
      return `${productName} está agotado y no se puede agregar.`;
    }

    const currentQty = this.getCartQuantityForProduct(product);
    const available = getAvailableStock(product);
    return `Stock insuficiente para ${productName}. Disponible: ${available} ${getInventoryUnit(product)}. En venta: ${currentQty}.`;
  }

  getCartQuantityForProduct(product: any): number {
    const key = product?.name ?? product?.nombre;
    const item = this.cartService.cart.find((cartItem: any) => (cartItem.name ?? cartItem.nombre) === key);
    return Number(item?.quantity || 0);
  }

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

  private formatCustomerSearchLabel(customer: any): string {
    const name = customer?.nombre || 'Cliente';
    const identification = customer?.num_identificacion ? ` - ${customer.num_identificacion}` : '';
    return `${name}${identification}`;
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
      this.filteredCustomers = customers;
      this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    });
  }

  private openCustomerCreateFromIdentification(identification: string): void {
    const tipoIdentificacion = identification.length === 10 ? '05 - Cedula' : '04 - RUC';
    this.clienteForm.patchValue({
      num_identificacion: identification,
      tipo_identificacion: tipoIdentificacion
    }, { emitEvent: false });
    this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    this.showCustomerModal = true;
    toast.error('Cliente no encontrado con esa identificacion.');
  }

  private buildOrderPayload(typePago: 'Nota Venta' | 'Factura') {
    const paymentResult = buildSinglePaymentPayload(this.payments, this.paymentMethod, this.total);
    if (paymentResult.error) {
      toast.error(paymentResult.error);
      return null;
    }

    return {
      table: this.selectedTableId || null,
      customer: this.customer?.name,
      alias: this.alias.trim(),
      estado: typePago,
      total: this.total.toFixed(2),
      type_orden: this.orderType,
      delivery_address: this.deliveryAddress,
      delivery_phone: this.deliveryPhone,
      fecha: this.today,
      status: typePago === 'Factura' ? 'Cerrada' : 'Ingresada',
      items: this.cartService.cart.map(item => ({
        product: item.name ?? item.nombre,
        qty: item.quantity,
        rate: item.price,
        tax_rate: item.tax_value
      })),
      payments: paymentResult.payments
    };
  }

  private buildPosSaleNotePayload(): any | null {
    const payment = findPaymentMethod(this.payments, this.paymentMethod);
    const litePayment = this.mapLitePayment(payment);
    const business = String(this.capabilities.activeBusinessId || '').trim();
    if (!business) {
      toast.error('Selecciona un negocio antes de emitir.');
      return null;
    }
    if (!litePayment || this.total <= 0) {
      toast.error('Selecciona un método de pago válido.');
      return null;
    }
    const terminal = String(this.capabilities.activePosTerminal?.name || '').trim();
    if (this.capabilities.getPosTerminalBlockMessage()) {
      toast.error(this.capabilities.getPosTerminalBlockMessage()!);
      return null;
    }
    const payload: any = {
      business,
      pos_terminal: terminal || undefined,
      customer: this.customer?.name || undefined,
      items: this.cartService.cart.map((item: any) => ({
        item: item.name ?? item.nombre,
        qty: Number(item.quantity || 0),
        rate: Number(item.price || 0),
        discount_percentage: Number(item.discount_pct || 0),
        discount_amount: 0,
        tax_rate: Number(item.tax_value || 0)
      })),
      payments: [{
        payment_method: litePayment.payment_method,
        payment_code: litePayment.payment_code,
        amount: Number((this.isSelectedPaymentCash && Number(this.amountReceived) > 0 ? Number(this.amountReceived) : this.total).toFixed(2)),
        reference: ''
      }],
      notes: ''
    };
    if (!payload.pos_terminal) delete payload.pos_terminal;
    if (!payload.customer) delete payload.customer;
    return payload;
  }

  /**
   * El catálogo de métodos puede llegar con nombres en español, códigos SRI
   * o aliases del DocType. El contrato de FacturADA Lite, en cambio, espera
   * siempre el par canónico payment_method/payment_code.
   */
  private mapLitePayment(payment: any): { payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'; payment_code: '01' | '19' | '20' } | null {
    const raw = payment || {};
    const value = [
      raw.payment_method,
      raw.method,
      raw.nombre,
      raw.description,
      raw.name,
      this.paymentMethod
    ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const code = String(raw.payment_code || raw.codigo || raw.forma_pago || '').trim();

    if (/(^|\s)(CASH|EFECTIVO)(\s|$)/.test(value) || code === '01') {
      // OTHER también utiliza el código 01, por eso se comprueba explícitamente
      // antes de aplicar el fallback por código.
      if (/(^|\s)(OTHER|OTRO|OTROS)(\s|$)/.test(value)) {
        return { payment_method: 'OTHER', payment_code: '01' };
      }
      return { payment_method: 'CASH', payment_code: '01' };
    }
    if (/(CARD|TARJETA|CREDITO|CREDIT|DEBITO|DEBIT)/.test(value) || code === '19') {
      return { payment_method: 'CARD', payment_code: '19' };
    }
    if (/(TRANSFER|TRANSFERENCIA|DEPOSITO|DEPOSIT)/.test(value) || code === '20') {
      return { payment_method: 'TRANSFER', payment_code: '20' };
    }
    if (/(OTHER|OTRO|OTROS)/.test(value)) {
      return { payment_method: 'OTHER', payment_code: '01' };
    }

    return null;
  }

  /**
   * El POS genérico tiene dos documentos distintos:
   * - Nota de Venta: usa pos_sale y queda en borrador.
   * - Factura: usa directamente create_and_emit_from_ui_v2.
   */
  private buildDirectLiteInvoicePayload(): any | null {
    const payload = this.buildPosSaleNotePayload();
    if (!payload) return null;

    return {
      ...payload,
      environment: this.ambiente || undefined,
      // En una factura el pago aplicado debe cuadrar con el total. El
      // excedente de efectivo se presenta como cambio, no como monto pagado.
      payments: (payload.payments || []).map((payment: any) => ({
        ...payment,
        amount: Number(this.total.toFixed(2))
      })),
      additional_fields: [],
      auto_queue: true
    };
  }

  private submitPosSaleNote(payload: any): void {
    this.isSubmittingPosSale = true;
    this.spinner.show();
    this.posSaleService.create(payload).pipe(finalize(() => {
      this.isSubmittingPosSale = false;
      this.spinner.hide();
    })).subscribe({
      next: (response: any) => {
        const stockControlled = this.cartService.cart.some((item: any) => hasInventoryControl(item));
        this.activePosSaleNote = { status: 'Borrador', ...(response?.data || response), __stockControlled: stockControlled };
        this.clearPage();
        toast.success('Nota de venta creada en borrador.');
      },
      error: (err: any) => toast.error(this.extractApiError(err) || 'No se pudo crear la nota de venta.')
    });
  }

  private submitDirectLiteInvoice(payload: any): void {
    this.isSubmittingPosSale = true;
    this.spinner.show();
    this.invoicesService.create_and_emit_from_ui_v2(payload).pipe(finalize(() => {
      this.isSubmittingPosSale = false;
      this.spinner.hide();
    })).subscribe({
      next: (response: any) => {
        const state = response?.state || liteEmissionState(response?.emission || response?.data || response);
        const messages = [
          ...liteEmissionMessages(response?.emission),
          ...liteEmissionMessages(response?.data),
          ...liteEmissionMessages(response)
        ].filter(Boolean);
        const invoiceName = String(
          response?.invoiceName
            || response?.data?.name
            || response?.data?.invoice_name
            || response?.emission?.invoice_name
            || ''
        ).trim();

        if (!invoiceName) {
          toast.error(messages[0] || 'La factura no devolvió un identificador válido.');
          return;
        }

        this.clearPage();
        this.refreshProductsSilently();
        if (state === 'AUTHORIZED') {
          toast.success('Factura autorizada por el SRI.');
          this.openInvoicePrintModal(invoiceName);
        } else if (state === 'PROCESSING') {
          toast.info(messages[0] || 'Factura recibida. Consulta su autorización desde el detalle.');
          this.router.navigate(['/dashboard/invoices', invoiceName]);
        } else if (state === 'REJECTED') {
          toast.error(messages[0] || 'La factura fue rechazada por el SRI.');
          this.router.navigate(['/dashboard/invoices', invoiceName]);
        } else {
          toast.error(messages[0] || 'No se pudo emitir la factura.');
          this.router.navigate(['/dashboard/invoices', invoiceName]);
        }
      },
      error: (error: any) => toast.error(this.extractApiError(error) || 'No se pudo emitir la factura.')
    });
  }

  collectPosSaleNote(): void {
    const name = String(this.activePosSaleNote?.name || '').trim();
    if (!name || this.isSubmittingPosSale) return;
    const noteItems = Array.isArray(this.activePosSaleNote?.items) ? this.activePosSaleNote.items : [];
    if (this.capabilities.features.inventory !== true && (this.activePosSaleNote?.__stockControlled === true || noteItems.some((item: any) => item?.track_stock === true || item?.track_stock === 1))) {
      toast.error('No se puede cobrar: esta venta contiene productos con control de stock y el inventario no está incluido en el plan.');
      return;
    }
    this.isSubmittingPosSale = true;
    this.posSaleService.collect(name).pipe(finalize(() => this.isSubmittingPosSale = false)).subscribe({
      next: (response: any) => {
        this.activePosSaleNote = { ...this.activePosSaleNote, ...(response?.data || response || {}) };
        toast.success('Nota de venta cobrada.');
        this.printPosSaleNote(name);
      },
      error: (err: any) => toast.error(this.extractApiError(err) || 'No se pudo cobrar la nota de venta.')
    });
  }

  invoicePosSaleNote(): void {
    const name = String(this.activePosSaleNote?.name || '').trim();
    if (!name || this.isSubmittingPosSale) return;
    if (String(this.activePosSaleNote?.status || '').trim() !== 'Cobrada') {
      toast.warning('La nota debe estar cobrada antes de facturarla.');
      return;
    }
    this.isSubmittingPosSale = true;
    this.posSaleService.invoice(name).pipe(finalize(() => this.isSubmittingPosSale = false)).subscribe({
      next: (response: any) => {
        this.activePosSaleNote = { ...this.activePosSaleNote, ...(response?.data || response || {}) };
        const invoice = this.activePosSaleNote?.lite_invoice;
        const invoiceName = String(
          typeof invoice === 'string' ? invoice : invoice?.name
            || this.activePosSaleNote?.invoice_name
            || response?.emission?.invoice_name
            || ''
        ).trim();
        if (invoiceName) {
          toast.success('Nota facturada.');
          this.router.navigate(['/dashboard/invoices', invoiceName]);
        } else {
          toast.info('La nota fue enviada a facturación.');
        }
      },
      error: (err: any) => toast.error(this.extractApiError(err) || 'No se pudo facturar la nota de venta.')
    });
  }

  cancelPosSaleNote(): void {
    const name = String(this.activePosSaleNote?.name || '').trim();
    if (!name || this.isSubmittingPosSale) return;
    if (this.activePosSaleNote?.lite_invoice) {
      toast.warning('No se puede anular una nota que ya tiene factura.');
      return;
    }
    this.isSubmittingPosSale = true;
    this.posSaleService.cancel(name).pipe(finalize(() => this.isSubmittingPosSale = false)).subscribe({
      next: (response: any) => {
        this.activePosSaleNote = { ...this.activePosSaleNote, ...(response?.data || response || {}) };
        toast.success('Nota de venta anulada.');
      },
      error: (err: any) => toast.error(this.extractApiError(err) || 'No se pudo anular la nota de venta.')
    });
  }

  printPosSaleNote(name: string): void {
    this.posSaleService.downloadPdf(name).subscribe({
      next: (blob) => this.openPdfBlob(blob),
      error: () => toast.error('No se pudo descargar la Nota de Venta.')
    });
  }

  private ensureValidPaymentMethod(): void {
    const current = findPaymentMethod(this.payments, this.paymentMethod);
    this.paymentMethod = current?.name || current?.codigo || getDefaultPaymentValue(this.payments);
  }

  private submitOrder(payload: any): void {
    if (payload?.estado === 'Factura') {
      const terminalBlockMessage = this.capabilities.getPosTerminalBlockMessage();
      if (terminalBlockMessage) {
        toast.error(terminalBlockMessage);
        return;
      }
    }
    this.isSubmittingOrder = true;
    this.spinner.show();
    this.ordersService.create_order_v2(payload).pipe(finalize(() => {
      this.isSubmittingOrder = false;
      this.spinner.hide();
    })).subscribe({
      next: (res: any) => {
        const orderId = String(res?.message?.data?.name ?? res?.message?.name ?? res?.data?.name ?? '').trim();
        if (!orderId) {
          toast.error('No se recibio numero de orden.');
          return;
        }
        this.notifyOrderResult(res, payload?.estado === 'Factura');
        this.refreshProductsSilently();
        window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
        if (this.selectedTableId) {
          this.router.navigate(['/dashboard/orders', orderId]);
          return;
        }
        this.openPrintModal(orderId);
      }
    });
  }

  /** La factura se emite dentro de create_order_v2; no se crea una segunda factura desde POS. */
  private notifyOrderResult(response: any, isInvoice: boolean): void {
    const emission = response?.message?.emission ?? response?.message?.data?.emission;
    if (!isInvoice || !emission) {
      toast.success(`Pedido guardado${this.isSelectedPaymentCash ? `. Cambio: $${this.change.toFixed(2)}` : ''}`);
      return;
    }

    const message = liteEmissionMessages(emission)[0];
    const change = this.isSelectedPaymentCash ? `. Cambio: $${this.change.toFixed(2)}` : '';
    switch (liteEmissionState(emission)) {
      case 'AUTHORIZED': toast.success(`Factura autorizada${change}`); break;
      case 'PROCESSING': toast.info(message || 'Factura emitida. La autorización del SRI está en proceso.'); break;
      case 'REJECTED': toast.error(message || 'La factura fue rechazada por el SRI.'); break;
      default: toast.error(message || 'La orden fue creada, pero la emisión electrónica no se completó.');
    }
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

  private openPdfBlob(blob: Blob): void {
    const url = window.URL.createObjectURL(blob);
    const popup = window.open(url, '_blank', 'noopener=yes,noreferrer=yes');
    if (!popup) toast.error('No se pudo abrir el ticket descargado.');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
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

  private loadFavorites(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(this.favoritesStorageKey) || '[]');
      if (!Array.isArray(raw)) return;
      this.favoriteProductKeys = new Set(
        raw.map((x: any) => String(x || '').trim()).filter((x: string) => !!x)
      );
    } catch {
      this.favoriteProductKeys = new Set<string>();
    }
  }

  private persistFavorites(): void {
    localStorage.setItem(this.favoritesStorageKey, JSON.stringify(Array.from(this.favoriteProductKeys)));
  }

  private syncFavoriteProducts(): void {
    this.sanitizeFavorites();
    this.favoriteProducts = this.filteredProductList.filter((product: any) => this.isFavorite(product));
  }

  private getProductKey(product: any): string {
    return String(product?.name || product?.id || product?.codigo || product?.nombre || '').trim();
  }

  private refreshProductsSilently(): void {
    this.productsService.getAll(1).subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res) ? res : (res?.message?.data || []);
        this.applyFilters();
      }
    });
  }

  private sanitizeFavorites(): void {
    const availableKeys = new Set(
      (this.products || [])
        .filter((product: any) => canSellProduct(product))
        .map((product: any) => this.getProductKey(product))
        .filter((key: string) => !!key)
    );

    let changed = false;
    for (const key of Array.from(this.favoriteProductKeys)) {
      if (!availableKeys.has(key)) {
        this.favoriteProductKeys.delete(key);
        changed = true;
      }
    }

    if (changed) this.persistFavorites();
  }
}
