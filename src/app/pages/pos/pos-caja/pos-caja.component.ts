import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize, Subject } from 'rxjs';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { CategoryService } from 'src/app/services/category.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { PosSaleService } from 'src/app/services/pos-sale.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { InvoiceCollectionsService } from 'src/app/services/invoice-collections.service';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from 'src/environments/environment';
import { CartService } from '../services/cart.service';
import { canSellProduct, getAvailableStock, getInventoryUnit, hasInventoryControl, isLowStockProduct, isOutOfStockProduct, resolveInventoryLabel, toInventoryNumber } from 'src/app/shared/utils/inventory.utils';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { buildMultiplePaymentPayload, findPaymentMethod, getDefaultPaymentValue, getPaymentDisplayLabel, isCashPayment, isPaymentMethodAlreadySelected, PaymentRow, roundMoney } from 'src/app/shared/utils/payment.utils';
import { liteEmissionMessages, liteEmissionState } from 'src/app/core/utils/lite-invoice-emission';
import { ProductVariantPickerComponent } from 'src/app/shared/components/product-variant-picker/product-variant-picker.component';
import { BarcodeScanInputComponent } from 'src/app/shared/components/barcode-scan-input/barcode-scan-input.component';
import { ProductSearchModalComponent } from 'src/app/shared/components/product-search-modal/product-search-modal.component';
import { formatVariantAttributes } from 'src/app/shared/utils/product-variants.utils';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import {
  FINAL_CONSUMER_INVOICE_LIMIT, exceedsFinalConsumerLimit, extractApiError, extractCashOpeningName,
  extractOrderId, extractOrderInvoice, liteItemsFromCart, mapLitePayment, normalizeBackendEnvironment,
  orderItemsFromCart, readLiteInvoiceResponse
} from './pos-sale.rules';
import { PosProductCardComponent } from './ui/pos-product-card.component';
import { PosCartLinesComponent } from './ui/pos-cart-lines.component';
import { PosTotalsComponent } from './ui/pos-totals.component';
import { PosPrintModalComponent } from './ui/pos-print-modal.component';
import { PosShortcutsHelpComponent } from './ui/pos-shortcuts-help.component';
import { PosCustomerPickerComponent } from './ui/pos-customer-picker.component';

@Component({
  selector: 'app-pos-caja',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, FontAwesomeModule, NgSelectModule, ProductVariantPickerComponent,
    BarcodeScanInputComponent, ProductSearchModalComponent, DecimalInputDirective,
    PosProductCardComponent, PosCartLinesComponent, PosTotalsComponent, PosPrintModalComponent, PosShortcutsHelpComponent, PosCustomerPickerComponent
  ],
  templateUrl: './pos-caja.component.html',
  styles: [':host { display: block; height: 100%; min-height: 0; }']
})
export class PosCajaComponent implements OnInit, OnDestroy {
  @Input() selectedTableId = '';
  @Input() selectedTableLabel = '';
  @ViewChild('productVariantPicker') productVariantPicker!: ProductVariantPickerComponent;
  @ViewChild(BarcodeScanInputComponent) barcodeScanInput?: BarcodeScanInputComponent;
  @ViewChild(ProductSearchModalComponent) productSearchModal?: ProductSearchModalComponent;
  ambiente = '';
  showPaymentModal = false;
  showPrintModal = false;
  showReceivablesModal = false;
  showCollectionModal = false;
  showShortcutsHelp = false;
  isSubmittingOrder = false;
  isSubmittingPosSale = false;
  activePosSaleNote: any | null = null;
  receivables: any[] = [];
  selectedReceivable: any | null = null;
  loadingReceivables = false;
  savingCollection = false;
  checkingCashOpening = false;

  amountReceived: number | null = null;
  change = 0;

  products: any[] = [];
  /** Solo para la búsqueda avanzada (Ctrl+K): mismo catálogo pero con variantes ya expandidas. Ver `loadProductsFlat`. */
  productsFlat: any[] = [];
  filteredProductList: any[] = [];
  favoriteProducts: any[] = [];
  categories: any[] = [];
  payments: any[] = [];

  customer: any = null;
  alias = '';
  searchTerm = '';
  selectedCategory = '';
  productView: 'all' | 'favorites' = 'all';
  orderType: 'Servirse' | 'Llevar' | 'Domicilio' = 'Servirse';
  deliveryAddress = '';
  deliveryPhone = '';
  paymentMethod = '';
  paymentRows: PaymentRow[] = [{ method: '', amount: 0 }];
  paymentCondition: 'Contado' | 'Credito' = 'Contado';
  paymentDueDate = '';
  initialCollectionMethod = '';
  initialCollectionAmount: number | null = null;
  initialCollectionReference = '';
  initialCollectionNotes = 'Abono inicial acordado con cliente';
  collectionAmount: number | null = null;
  collectionMethod = '';
  collectionReference = '';
  collectionNotes = 'Abono desde POS';

  printOption: 'comanda' | 'recibo' | 'ambas' = 'ambas';
  private pendingOrderId: string | null = null;
  private pendingInvoiceId: string | null = null;
  printContext: 'order' | 'invoice' = 'order';
  private today = '';
  private readonly url = environment.URL;
  private readonly favoritesStorageKey = 'pos_caja_favorites_v1';
  private readonly destroy$ = new Subject<void>();
  private favoriteProductKeys = new Set<string>();


  constructor(
    public menuService: MenuService,
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private paymentsService: PaymentsService,
    private ordersService: OrdersService,
    private posSaleService: PosSaleService,
    private invoicesService: InvoicesService,
    private collectionsService: InvoiceCollectionsService,
    private spinner: NgxSpinnerService,
    private printService: PrintService,
    public cartService: CartService,
    public alertService: AlertService,
    private capabilities: CompanyCapabilitiesService,
    private utilsService: UtilsService,
    private router: Router
  ) { }

  /**
   * Atajos globales del POS: no interceptan teclas normales de escritura
   * (letras, números, backspace/delete) para no romper la edición de texto
   * en ningún input; solo F-keys, Escape y combinaciones con Ctrl, que nunca
   * insertan un carácter.
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    // Ctrl+K: búsqueda avanzada (igual que F3).
    if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.productSearchModal?.open();
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    switch (event.key) {
      case 'F3':
        event.preventDefault();
        this.productSearchModal?.open();
        break;
      case 'F10':
        event.preventDefault();
        if (!this.showPaymentModal && !this.showPrintModal) this.abrirModalPago();
        break;
      case 'Escape':
        if (this.showPrintModal) { this.closePrintModal(); }
        else if (this.showCollectionModal) { this.showCollectionModal = false; }
        else if (this.showReceivablesModal) { this.closeReceivables(); }
        else if (this.showPaymentModal) { this.showPaymentModal = false; this.refocusScanner(); }
        else if (this.showShortcutsHelp) { this.showShortcutsHelp = false; this.refocusScanner(); }
        break;
    }
  }

  toggleShortcutsHelp(): void {
    this.showShortcutsHelp = !this.showShortcutsHelp;
  }

  ngOnInit(): void {
    if (this.selectedTableLabel && !this.alias) this.alias = this.selectedTableLabel;
    // El ambiente se toma exclusivamente del contexto/perfil tributario del
    // negocio activo. No reutilizar un valor global guardado en el navegador.
    this.ambiente = this.backendEnvironment();
    this.today = this.buildEcuadorIsoDate();
    this.loadFavorites();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
   * restaurant order.
   *
   * This can't be decided from the `generic_pos` feature flag alone: a
   * business can have both `restaurant` and `generic_pos` active at the
   * same time, and this same component is rendered from both the
   * restaurant POS (`/dashboard/pos`, via PosShellComponent) and the
   * generic POS (`/dashboard/pos-generic`) routes. The route is what
   * actually tells the two apart. */
  get genericMode(): boolean {
    return this.router.url.includes('/pos-generic') && this.capabilities.isEnabled('generic_pos');
  }

  get canEmitInvoice(): boolean {
    return this.capabilities.hasPermission('billing.create')
      && this.capabilities.canEmit()
      && !this.capabilities.getPosTerminalBlockMessage();
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

  /** Sin ningún terminal configurado: se bloquea toda la pantalla, no solo la emisión. */
  get needsPosTerminalConfiguration(): boolean {
    return this.capabilities.needsPosTerminalConfiguration;
  }

  /** Varios terminales activos y ninguno elegido todavía: hay que mostrar el selector. */
  get needsPosTerminalSelection(): boolean {
    return this.capabilities.needsPosTerminalSelection;
  }

  /** Preferencia visual del POS configurada fuera del frontend; adapta solo presentación, nunca lógica de venta. */
  get isRetailPos(): boolean {
    return this.capabilities.isRetailPos;
  }

  /** "Color: Negro · Talla: M" para una línea del carrito, o '' si el producto no tiene atributos de variante. */
  cartLineAttributes(item: any): string {
    const label = formatVariantAttributes(item);
    return label === '—' ? '' : label;
  }

  goToPosTerminalSettings(): void {
    this.router.navigate(['/settings/lite/pos-terminals']);
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
    return this.paymentRows.some((row) => isCashPayment(this.payments, row.method));
  }

  get canUseCreditSales(): boolean {
    return this.genericMode && this.capabilities.hasPermission('billing.manage');
  }

  get canViewReceivables(): boolean {
    return this.genericMode && (this.capabilities.hasPermission('*') || this.capabilities.hasPermission('billing.read'));
  }

  get canManageReceivables(): boolean {
    return this.genericMode && (this.capabilities.hasPermission('*') || this.capabilities.hasPermission('billing.manage'));
  }

  get isCreditSale(): boolean {
    return this.paymentCondition === 'Credito';
  }

  get initialCollectionValue(): number {
    return Math.max(0, roundMoney(this.initialCollectionAmount));
  }

  get creditOutstandingAmount(): number {
    return Math.max(0, roundMoney(this.total - this.initialCollectionValue));
  }

  get selectedReceivableOutstanding(): number {
    return Math.max(0, roundMoney(
      this.selectedReceivable?.totals?.outstanding_amount
      ?? this.selectedReceivable?.outstanding_amount
      ?? 0
    ));
  }

  get paymentRowsTotal(): number {
    return roundMoney(this.paymentRows.reduce((total, row) => total + roundMoney(row?.amount), 0));
  }

  get paymentRemaining(): number {
    return roundMoney(this.total - this.paymentRowsTotal);
  }

  get cashPaymentAmount(): number {
    return roundMoney(this.paymentRows.reduce((total, row) =>
      total + (isCashPayment(this.payments, row.method) ? roundMoney(row.amount) : 0), 0));
  }

  addPaymentRow(): void {
    const method = this.payments.find((item: any) => !isPaymentMethodAlreadySelected(this.payments, this.paymentRows, item?.name || item?.codigo));
    if (!method) {
      toast.warning('No hay más métodos de pago disponibles para agregar.');
      return;
    }
    this.paymentRows.push({ method: method.name || method.codigo, amount: Math.max(0, this.paymentRemaining) });
    this.onPaymentMethodChange();
  }

  removePaymentRow(index: number): void {
    if (this.paymentRows.length <= 1) {
      toast.warning('Debes conservar al menos un método de pago.');
      return;
    }
    this.paymentRows.splice(index, 1);
    this.onPaymentMethodChange();
  }

  onPaymentRowMethodChange(index: number): void {
    const row = this.paymentRows[index];
    if (row && isPaymentMethodAlreadySelected(this.payments, this.paymentRows, row.method, index)) {
      row.method = '';
      toast.warning('Ese método de pago ya fue agregado.');
    }
    this.onPaymentMethodChange();
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
    this.loadProductsFlat();
  }

  loadCategory(): void {
    this.spinner.show();
    this.categoryService.getAll().pipe(finalize(() => this.spinner.hide())).subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : (res?.message?.data || res?.data || []);
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

  applyFilters(): void {
    const term = this.normalize(this.searchTerm);
    const selectedCat = this.normalize(this.selectedCategory);
    this.sanitizeFavorites();

    const filtered = (this.products || []).filter((product: any) => {
      const okCat = this.productMatchesCategory(product, selectedCat);
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

  /**
   * Punto de entrada desde la grilla. El producto puede ser uno simple (se
   * agrega directo) o un agrupador de variantes (el selector pide Color/Talla
   * antes de resolver). La validación de stock se aplica siempre sobre el
   * producto ya resuelto, nunca sobre el agrupador.
   */
  onProductCardClick(product: any): void {
    this.productVariantPicker.open(product);
  }

  onVariantResolved(resolved: any): void {
    this.addProduct(resolved);
    this.refocusScanner();
  }

  /** Se usa al cerrar el picker de variantes o la búsqueda avanzada sin elegir nada, y después de agregar un producto. */
  refocusScanner(): void {
    this.barcodeScanInput?.focus();
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
    this.cartService.decrease(item);
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

    if (this.paymentRows.length === 1) this.paymentRows[0].amount = this.total;
    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = true;
  }

  setPaymentCondition(condition: 'Contado' | 'Credito'): void {
    if (condition === 'Credito' && !this.canUseCreditSales) {
      toast.error('No tienes permiso para registrar ventas a crédito.');
      return;
    }
    this.paymentCondition = condition;
    if (condition === 'Contado') this.resetCreditSaleFields();
    this.amountReceived = null;
    this.change = 0;
  }

  calcularCambio(): void {
    if (!this.isSelectedPaymentCash) {
      this.change = 0;
      return;
    }
    const recibido = Number(this.amountReceived);
    this.change = Number.isFinite(recibido) ? this.round2(recibido - this.cashPaymentAmount) : 0;
  }

  confirmarPago(typePago: 'Nota Venta' | 'Factura'): void {
    if (this.isSubmittingOrder || this.isSubmittingPosSale || this.checkingCashOpening) return;
    if (this.paymentRows.length === 1) this.paymentRows[0].amount = this.total;

    if (typePago === 'Factura') {
      if (!this.capabilities.hasPermission('billing.create')) {
        toast.error('No tiene permisos para emitir facturas.');
        return;
      }
      const planBlockMessage = this.invoicePlanBlockMessage;
      if (planBlockMessage) {
        toast.error(planBlockMessage);
        return;
      }
      if (this.isCreditSale && !this.canUseCreditSales) {
        toast.error('No tienes permiso para registrar ventas a crédito.');
        return;
      }
    }

    if (typePago === 'Nota Venta' && this.isCreditSale) {
      toast.error('Las ventas a crédito deben emitirse como factura.');
      return;
    }

    const hasReceivedAmount = this.amountReceived !== null
      && String(this.amountReceived).trim() !== '';
    const receivedAmount = Number(this.amountReceived);
    if (!this.isCreditSale && this.isSelectedPaymentCash && hasReceivedAmount
      && (!Number.isFinite(receivedAmount) || receivedAmount < this.cashPaymentAmount)) {
      toast.error('El monto recibido es menor al total.');
      return;
    }

    if (exceedsFinalConsumerLimit(this.customer, this.total, typePago)) {
      toast.error(`No se puede emitir una factura a CONSUMIDOR FINAL por un valor superior a USD ${FINAL_CONSUMER_INVOICE_LIMIT} IVA incluido. Seleccione un cliente identificado.`);
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
          if (typePago === 'Factura') this.submitDirectLiteInvoiceWithCashCheck(payload);
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
      items: orderItemsFromCart(this.cartService.cart)
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

  openPrintModal(orderId: string, invoiceId: string | null = null): void {
    this.pendingOrderId = orderId;
    this.pendingInvoiceId = invoiceId;
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

  handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas' | 'ticket' | 'ride' | 'skip'): void {
    if (this.printContext === 'invoice') {
      const invoiceId = this.pendingInvoiceId;
      if (!invoiceId) {
        this.finishPrintFlow();
        return;
      }
      if (option === 'ticket' || option === 'ride') {
        // Igual que comanda/recibo/RIDE de orden: navega directo a la URL que
        // genera Frappe (`/printview` o `download_lite_invoice_pdf`), sin
        // pasar por un blob de Angular. Abrir el popup así, en vez de dentro
        // del callback async de una descarga, evita que el navegador lo
        // bloquee como ventana emergente no solicitada.
        const path = option === 'ride'
          ? this.printService.getFacturaPdf(invoiceId)
          : this.printService.getSalesInvoiceTicket(invoiceId);
        this.openPrintWindow(path);
      }
      this.finishPrintFlow();
      return;
    }

    if (!this.pendingOrderId) return;

    if (this.pendingInvoiceId && option !== 'comanda') {
      const invoicePath = option === 'ambas'
        ? this.printService.getOrderPdf(this.pendingOrderId)
        : this.printService.getSalesInvoiceTicket(this.pendingInvoiceId);
      this.openPrintWindow(invoicePath);
      this.finishPrintFlow();
      return;
    }

    if (option === 'comanda') this.openPrintWindow(this.printService.getComanda(this.pendingOrderId));
    if (option === 'recibo') this.openPrintWindow(this.printService.getRecibo(this.pendingOrderId));
    if (option === 'ambas') this.openPrintWindow(this.printService.getOrderPdf(this.pendingOrderId));

  }

  closePrintModal(): void {
    this.finishPrintFlow();
  }

  private finishPrintFlow(): void {
    this.showPrintModal = false;
    this.pendingOrderId = null;
    this.pendingInvoiceId = null;
    this.printContext = 'order';
    this.clearPage();
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

  clearPage(): void {
    this.cartService.clear();
    // El selector de cliente se reinicia solo al recibir `customer = null`.
    this.customer = null;
    this.alias = '';
    this.amountReceived = null;
    this.change = 0;
    this.paymentRows = [{ method: '', amount: 0 }];
    this.paymentCondition = 'Contado';
    this.resetCreditSaleFields();
    this.showPaymentModal = false;
    this.orderType = 'Servirse';
    this.deliveryAddress = '';
    this.deliveryPhone = '';
    this.searchTerm = '';
    this.onCategorySelected('');
    // El carrito quedó vacío (factura, nota u orden ya se registraron): el
    // cajero sigue atendiendo, así que el foco vuelve al input de escaneo en
    // vez de obligarlo a hacer clic ahí antes de leer el siguiente código.
    this.barcodeScanInput?.focus();
  }

  trackByProductId = (_: number, p: any) => p?.id || p?._id || p?.codigo || p?.name || p?.nombre;
  trackByFavorite = (_: number, p: any) => this.getProductKey(p);

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
    return resolveInventoryLabel(product);
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

  private loadInitialData(): void {
    this.loadProducts();
    this.loadCategory();
    this.loadMethodPayment();
  }

  private buildOrderPayload(typePago: 'Nota Venta' | 'Factura') {
    if (this.paymentRows.length === 1) this.paymentRows[0].amount = this.total;
    const paymentResult = buildMultiplePaymentPayload(this.payments, this.paymentRows, this.total);
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
      items: orderItemsFromCart(this.cartService.cart),
      payments: paymentResult.payments
    };
  }

  private buildPosSaleNotePayload(): any | null {
    if (this.paymentRows.length === 1) this.paymentRows[0].amount = this.total;
    const paymentResult = buildMultiplePaymentPayload(this.payments, this.paymentRows, this.total);
    const business = String(this.capabilities.activeBusinessId || '').trim();
    if (!business) {
      toast.error('Selecciona un negocio antes de emitir.');
      return null;
    }
    if (paymentResult.error || this.total <= 0) {
      toast.error(paymentResult.error || 'Selecciona un método de pago válido.');
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
      items: liteItemsFromCart(this.cartService.cart),
      payments: paymentResult.payments.map((row) => {
        const selected = findPaymentMethod(this.payments, row.formas_de_pago);
        const litePayment = this.mapLitePayment(selected, row.formas_de_pago);
        return litePayment ? {
          payment_method: litePayment.payment_method,
          payment_code: litePayment.payment_code,
          amount: row.monto,
          reference: ''
        } : null;
      }).filter(Boolean),
      notes: ''
    };
    if (!payload.pos_terminal) delete payload.pos_terminal;
    if (!payload.customer) delete payload.customer;
    return payload;
  }

  /** Ver `mapLitePayment` en pos-sale.rules: el método seleccionado en pantalla es el respaldo. */
  private mapLitePayment(payment: any, fallback = ''): ReturnType<typeof mapLitePayment> {
    return mapLitePayment(payment, fallback || this.paymentMethod);
  }

  /**
   * El POS genérico tiene dos documentos distintos:
   * - Nota de Venta: usa pos_sale y queda en borrador.
   * - Factura: usa directamente create_and_emit_from_ui_v2.
   */
  private buildDirectLiteInvoicePayload(): any | null {
    const payload = this.buildPosSaleNotePayload();
    if (!payload) return null;

    const initialCollection = this.buildInitialCollection();
    if (initialCollection === null) return null;

    return {
      ...payload,
      environment: this.backendEnvironment() || undefined,
      // Cada fila ya fue validada para cuadrar exactamente con el total. El
      // excedente recibido en efectivo se trata como cambio, no como pago.
      payments: payload.payments || [],
      payment_condition: this.isCreditSale ? 'Credito' : 'Contado',
      ...(this.isCreditSale && this.paymentDueDate ? { payment_due_date: this.paymentDueDate } : {}),
      ...(initialCollection ? { initial_collection: initialCollection } : {}),
      additional_fields: [],
      auto_queue: true
    };
  }

  /**
   * En crédito, `payments` conserva la forma de pago fiscal por el total de
   * la factura. El dinero realmente recibido viaja únicamente aquí para no
   * duplicarlo ni alterar el saldo de cartera.
   */
  private buildInitialCollection(): any | null | undefined {
    if (!this.isCreditSale) return undefined;
    const amount = this.initialCollectionValue;
    const methodValue = String(this.initialCollectionMethod || '').trim();
    if (amount === 0 && !methodValue) return undefined;
    if (!methodValue || amount <= 0) {
      toast.error('Selecciona el método y el monto del abono inicial.');
      return null;
    }
    if (amount > this.total) {
      toast.error('El abono inicial no puede ser mayor al total de la factura.');
      return null;
    }
    const method = findPaymentMethod(this.payments, methodValue);
    const mapped = this.mapLitePayment(method, methodValue);
    if (!mapped) {
      toast.error('Selecciona un método de pago válido para el abono inicial.');
      return null;
    }
    return {
      ...mapped,
      amount,
      reference: String(this.initialCollectionReference || '').trim(),
      notes: String(this.initialCollectionNotes || '').trim()
    };
  }

  private submitDirectLiteInvoiceWithCashCheck(payload: any): void {
    const initialCollection = payload?.initial_collection;
    if (String(initialCollection?.payment_code || '') !== '01') {
      this.submitDirectLiteInvoice(payload);
      return;
    }

    if (this.checkingCashOpening) return;
    this.checkingCashOpening = true;
    this.collectionsService.getCurrentCashOpening().subscribe({
      next: (response: any) => {
        this.checkingCashOpening = false;
        const cashOpening = extractCashOpeningName(response);
        if (!cashOpening) {
          this.handleMissingCashOpening();
          return;
        }
        payload.initial_collection = { ...initialCollection, cash_opening: cashOpening };
        this.submitDirectLiteInvoice(payload);
      },
      error: () => {
        this.checkingCashOpening = false;
        this.handleMissingCashOpening();
      }
    });
  }

  private handleMissingCashOpening(): void {
    toast.error('Debe abrir caja antes de cobrar un abono inicial en efectivo.');
    this.router.navigate(['/caja/apertura']);
  }

  private resetCreditSaleFields(): void {
    this.paymentDueDate = '';
    this.initialCollectionMethod = '';
    this.initialCollectionAmount = null;
    this.initialCollectionReference = '';
    this.initialCollectionNotes = 'Abono inicial acordado con cliente';
  }

  private backendEnvironment(): string {
    return normalizeBackendEnvironment(this.capabilities.business?.tax_profile?.environment
      ?? this.capabilities.business?.environment
      ?? this.capabilities.business?.ambiente);
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
      error: (err: any) => toast.error(extractApiError(err) || 'No se pudo crear la nota de venta.')
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
        const { body, data, emission, invoiceName } = readLiteInvoiceResponse(response);
        const state = response?.state || body?.state || data?.state || liteEmissionState(emission);
        const messages = [
          ...liteEmissionMessages(emission),
          ...liteEmissionMessages(data),
          ...liteEmissionMessages(body),
          ...liteEmissionMessages(response)
        ].filter(Boolean);

        if (!invoiceName) {
          toast.error(messages[0] || 'La factura no devolvió un identificador válido.');
          return;
        }

        const outstanding = Math.max(0, roundMoney(
          data?.totals?.outstanding_amount ?? data?.outstanding_amount ?? 0
        ));
        const totalCollected = Math.max(0, roundMoney(
          data?.totals?.total_collected ?? data?.total_collected ?? 0
        ));
        const collectionStatus = String(data?.collection_status ?? data?.totals?.collection_status ?? '').trim();
        this.clearPage();
        this.refreshProductsSilently();
        window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
        if (outstanding > 0 || collectionStatus === 'Abonada' || collectionStatus === 'Pendiente') {
          toast.success(`Factura emitida con saldo pendiente. Cobrado: $${totalCollected.toFixed(2)} · Saldo: $${outstanding.toFixed(2)}.`);
        }
        if (state === 'AUTHORIZED') {
          toast.success('Factura autorizada por el SRI.');
        } else if (state === 'PROCESSING') {
          toast.info(messages[0] || 'Factura recibida. Consulta su autorización cuando esté disponible.');
        } else if (state === 'REJECTED') {
          toast.error(messages[0] || 'La factura fue rechazada por el SRI.');
        } else {
          toast.error(messages[0] || 'No se pudo emitir la factura.');
        }
        // El ticket puede entregarse aunque la autorización SRI esté pendiente
        // o deba reintentarse. El RIDE oficial podrá descargarse cuando exista.
        this.openInvoicePrintModal(invoiceName);
      },
      error: (error: any) => toast.error(extractApiError(error) || 'No se pudo emitir la factura.')
    });
  }

  closeReceivables(): void {
    this.showReceivablesModal = false;
    this.refocusScanner();
  }

  closeShortcutsHelp(): void {
    this.showShortcutsHelp = false;
    this.refocusScanner();
  }

  /** El chip de ambiente se muestra en verde solo en Producción. */
  get isProductionEnvironment(): boolean {
    return normalizeBackendEnvironment(this.currentFiscalLocation?.environment || this.ambiente) === 'Produccion';
  }

  /**
   * Con una sola forma de pago su monto siempre es el total (misma regla que
   * `abrirModalPago` y `confirmarPago`): si un descuento cambia el total dentro
   * del cobro, el monto se resincroniza para no dejar el cobro descuadrado.
   */
  onCartChanged(): void {
    if (this.showPaymentModal && this.paymentRows.length === 1) {
      this.paymentRows[0].amount = this.total;
      this.calcularCambio();
    }
  }

  get cartItemsCount(): number {
    return this.cartService.cart.reduce((count, item) => count + (Number(item?.quantity) || 0), 0);
  }

  /** Por qué no se puede cobrar todavía; vacío cuando ya se puede. */
  get checkoutHint(): string {
    if (this.genericMode && this.posTerminalBlockMessage) return this.posTerminalBlockMessage;
    if (!this.cartService.cart.length) return 'Agrega productos para cobrar.';
    if (!this.customer) return 'Selecciona un cliente para cobrar.';
    return '';
  }

  openReceivables(): void {
    if (!this.canViewReceivables) {
      toast.error('No tienes permiso para consultar la cartera.');
      return;
    }
    this.showReceivablesModal = true;
    this.loadReceivables();
  }

  loadReceivables(): void {
    if (this.loadingReceivables) return;
    this.loadingReceivables = true;
    this.collectionsService.getReceivables({ only_open: true, limit: 20, offset: 0 })
      .pipe(finalize(() => this.loadingReceivables = false))
      .subscribe({
        next: (response: any) => {
          const message = response?.message ?? response ?? {};
          this.receivables = Array.isArray(message?.data) ? message.data : [];
        },
        error: (error: any) => toast.error(extractApiError(error) || 'No se pudo cargar la cartera.')
      });
  }

  openCollectionModal(receivable: any): void {
    if (!this.canManageReceivables) {
      toast.error('No tienes permiso para registrar abonos.');
      return;
    }
    const outstanding = Math.max(0, roundMoney(
      receivable?.totals?.outstanding_amount ?? receivable?.outstanding_amount ?? 0
    ));
    if (!outstanding) {
      toast.info('Esta factura no tiene saldo pendiente.');
      return;
    }
    this.selectedReceivable = receivable;
    this.collectionAmount = null;
    this.collectionMethod = '';
    this.collectionReference = '';
    this.collectionNotes = 'Abono desde POS';
    this.showCollectionModal = true;
  }

  submitCollection(): void {
    if (!this.canManageReceivables) {
      toast.error('No tienes permiso para registrar abonos.');
      return;
    }
    if (this.savingCollection || this.checkingCashOpening || !this.selectedReceivable) return;
    const amount = Math.max(0, roundMoney(this.collectionAmount));
    if (amount <= 0) {
      toast.error('Ingresa un monto de abono mayor a cero.');
      return;
    }
    if (amount > this.selectedReceivableOutstanding) {
      toast.error('El abono no puede ser mayor al saldo pendiente.');
      return;
    }
    const methodValue = String(this.collectionMethod || '').trim();
    const method = findPaymentMethod(this.payments, methodValue);
    const mapped = this.mapLitePayment(method, methodValue);
    if (!mapped) {
      toast.error('Selecciona un método de pago válido.');
      return;
    }
    const submit = () => {
      this.savingCollection = true;
      this.collectionsService.createCollection({
        invoice: String(this.selectedReceivable?.name || this.selectedReceivable?.invoice_name || '').trim(),
        ...mapped,
        amount,
        reference: String(this.collectionReference || '').trim(),
        notes: String(this.collectionNotes || '').trim()
      }).pipe(finalize(() => this.savingCollection = false)).subscribe({
        next: () => {
          toast.success('Abono registrado correctamente.');
          this.showCollectionModal = false;
          this.selectedReceivable = null;
          this.loadReceivables();
          window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
        },
        error: (error: any) => toast.error(extractApiError(error) || 'No se pudo registrar el abono.')
      });
    };
    // También en los abonos posteriores el efectivo exige caja abierta. El
    // backend asocia los demás medios a la apertura vigente cuando aplica.
    if (mapped.payment_code === '01') {
      this.checkingCashOpening = true;
      this.collectionsService.getCurrentCashOpening().subscribe({
        next: () => {
          this.checkingCashOpening = false;
          submit();
        },
        error: () => {
          this.checkingCashOpening = false;
          this.handleMissingCashOpening();
        }
      });
      return;
    }
    submit();
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
        // El stock se descuenta al cobrar la nota, no al crearla en borrador.
        this.refreshProductsSilently();
        toast.success('Nota de venta cobrada.');
        this.printPosSaleNote(name);
      },
      error: (err: any) => toast.error(extractApiError(err) || 'No se pudo cobrar la nota de venta.')
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
        this.refreshProductsSilently();
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
      error: (err: any) => toast.error(extractApiError(err) || 'No se pudo facturar la nota de venta.')
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
        // Si la nota ya estaba cobrada, anularla devuelve el stock descontado.
        this.refreshProductsSilently();
        toast.success('Nota de venta anulada.');
      },
      error: (err: any) => toast.error(extractApiError(err) || 'No se pudo anular la nota de venta.')
    });
  }

  printPosSaleNote(name: string): void {
    // Navega directo a la URL que genera Frappe (igual que comanda/recibo/
    // RIDE), en vez de traer un blob por Angular y recién ahí abrir el
    // popup: eso último se dispara fuera del gesto de clic del usuario y el
    // navegador puede bloquearlo como ventana emergente no solicitada.
    this.openPrintWindow(this.posSaleService.getPdfUrl(name));
  }

  private ensureValidPaymentMethod(): void {
    const current = findPaymentMethod(this.payments, this.paymentMethod);
    this.paymentMethod = current?.name || current?.codigo || getDefaultPaymentValue(this.payments);
    if (!this.paymentRows[0]?.method && this.paymentMethod) {
      this.paymentRows[0] = { method: this.paymentMethod, amount: this.total };
    }
  }

  private submitOrder(payload: any): void {
    if (payload?.estado === 'Factura') {
      if (!this.capabilities.hasPermission('billing.create')) {
        toast.error('No tiene permisos para emitir facturas.');
        return;
      }
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
        const orderId = extractOrderId(res);
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
        this.openPrintModal(orderId, extractOrderInvoice(res));
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

  private buildEcuadorIsoDate(): string {
    const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
    return date.toISOString();
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private normalize(txt: any = ''): string {
    return String(txt ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getProductCategoryName(p: any): string {
    return String(this.getProductCategoryValues(p)[0] ?? '');
  }

  private productMatchesCategory(product: any, selectedCategory: string): boolean {
    if (!selectedCategory) return true;
    const selected = this.normalize(selectedCategory);
    return this.getProductCategoryValues(product).some((value) => {
      const category = this.normalize(value);
      return !!category && (category === selected || category.includes(selected) || selected.includes(category));
    });
  }

  private getProductCategoryValues(product: any): Array<string | number> {
    const category = product?.category;
    const nested = category && typeof category === 'object'
      ? [category.name, category.category_name, category.nombre]
      : [category];
    return [
      product?.categoria,
      product?.category_name,
      product?.categoria_name,
      product?.item_group,
      product?.item_group_name,
      ...nested
    ].filter((value): value is string | number => value !== null && value !== undefined && value !== '');
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
    // El picker cachea las variantes por producto; sin esto, volver a elegir
    // el mismo producto seguiría mostrando el stock de antes de la venta.
    this.productVariantPicker?.clearCache();
    this.productsService.getAll(1).subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res) ? res : (res?.message?.data || []);
        this.applyFilters();
      }
    });
    this.loadProductsFlat();
  }

  /**
   * Igual que `products`, pero con `flatten_variants=1`: cada variante llega
   * como su propia fila (con su color/talla, precio y stock reales), no el
   * producto agrupador con "Ver variantes". Solo la usa la búsqueda avanzada
   * (Ctrl+K): el grid de tarjetas sigue mostrando agrupadores, sin cambios.
   */
  private loadProductsFlat(): void {
    this.productsService.getAll(1, undefined, 0, '', undefined, undefined, false, true).subscribe({
      next: (res: any) => {
        this.productsFlat = Array.isArray(res) ? res : (res?.message?.data || []);
      },
      error: () => undefined
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
