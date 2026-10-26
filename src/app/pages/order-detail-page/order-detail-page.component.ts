import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from 'src/environments/environment';
import { OrdersService } from 'src/app/services/orders.service';
import { OrderSplitService } from 'src/app/services/order-split.service';
import { OrderSplitRow, SplitOrderPayload } from 'src/app/services/order-split.types';
import { SplitOrderDialogComponent } from './components/split-order-dialog/split-order-dialog.component';
import { OrderSplitsTableComponent } from './components/order-splits-table/order-splits-table.component';
import { PaymentsService } from 'src/app/services/payments.service';
import { CustomersService } from 'src/app/services/customers.service';
import { canSellProduct, getInventoryUnit, hasInventoryControl, isLowStockProduct, isOutOfStockProduct, toInventoryNumber } from 'src/app/shared/utils/inventory.utils';
import { AlertService } from 'src/app/core/services/alert.service';
import { InvoicePaymentPayload, isPaymentMethodAlreadySelected, isTransferPayment, PAYMENT_REFERENCE_MAX_LENGTH, roundMoney, validatePaymentsTotal } from 'src/app/shared/utils/payment.utils';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { RestaurantRealtimeEvent, RestaurantRealtimeService } from 'src/app/services/restaurant-realtime.service';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { LineCents, fromCents, lineTotalsCents, toCents } from 'src/app/shared/utils/money-cents.utils';

type Product = any; // usa tu modelo si lo tienes
type OrderItem = {
  /** Nombre de la fila en la orden: permite al backend conservar precio y nota de cocina. */
  rowName?: string;
  notes?: string;
  productId?: string;
  productName?: string;
  description?: string;
  quantity: number;
  price: number;
  tax?: string | null;
  tax_value?: number;  // 0 o 15
  iva?: number;
  /** Descuento en dólares de la línea (viene del POS); se conserva al guardar. */
  discount?: number;
  /** Totales de la línea en centavos (fuente de verdad para sumar sin residuos). */
  cents?: LineCents;
  total?: number;      // subtotal SIN IVA (como haces en invoicing)
};

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    NgSelectModule,
    EcuadorTimePipe,
    FontAwesomeModule,
    DecimalInputDirective,
    SplitOrderDialogComponent,
    OrderSplitsTableComponent
  ],
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.css'
})
export class OrderDetailPageComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  order: any | null = null;

  // UI/estado
  products: Product[] = [];
  customers: any[] = [];
  orderCustomerId = '';
  orderItems: OrderItem[] = [];
  showSplitDialog = false;
  splitSubmitting = false;
  splitActionLoadingName = '';
  splitDeleteLoadingName = '';
  splitCustomerSavingName = '';
  splitsLoading = false;
  splitsLoaded = false;
  closingOrder = false;
  savingOrderChanges = false;
  orderInvoiceEmitting = false;
  orderSplits: OrderSplitRow[] = [];
  splitRemainingItems: any[] = [];
  paymentMethods: any[] = [];
  orderPayments: any[] = [];
  showMoreActions = false;
  showCustomerPicker = false;
  /** Etapas visibles en la barra de progreso de la orden. */
  readonly progressSteps = ['Ingresada', 'Preparación', 'Lista', 'Cerrada', 'Facturada'];

  private baseUrl = environment.URL;
  private readonly realtimeSub = new Subscription();
  roleName: 'Gerente' | 'Cajero' | 'Mesero' | 'Desconocido' = 'Desconocido';

  constructor(
    private route: ActivatedRoute,
    private productsSvc: ProductsService,
    private printSvc: PrintService,
    private router: Router,
    private ordersSvc: OrdersService,
    private orderSplitSvc: OrderSplitService,
    private paymentsSvc: PaymentsService,
    private customersSvc: CustomersService,
    private alertService: AlertService,
    private capabilities: CompanyCapabilitiesService,
    private restaurantRealtime: RestaurantRealtimeService,
  ) { }

  ngOnInit(): void {
    this.roleName = this.detectRole();
    const id = this.route.snapshot.paramMap.get('id')!;
    this.restaurantRealtime.activate();
    this.realtimeSub.add(this.restaurantRealtime.events$.subscribe((event) => this.applyRealtimeEvent(event, id)));
    this.fetch(id);
    this.loadProducts();
    this.loadCustomers();
    this.loadPaymentMethods();
  }

  ngOnDestroy(): void {
    this.realtimeSub.unsubscribe();
  }

  private applyRealtimeEvent(event: RestaurantRealtimeEvent, orderName: string): void {
    if (event.event_type.startsWith('order_split.')) {
      const data = event.data || {};
      const relatedOrder = data.order_name
        || data.order?.name
        || data.split?.order_name
        || data.split?.order?.name
        || (typeof data.order === 'string' ? data.order : '')
        || data.order_id;
      if (String(relatedOrder || '').trim() === String(orderName).trim()) this.loadOrderSplits();
      return;
    }
    if (event.event_type !== 'order.created' && event.event_type !== 'order.updated') return;
    if (String(event.data?.name || '').trim() !== String(orderName).trim()) return;
    const incoming = event.data || {};
    this.order = { ...(this.order || {}), ...incoming };
    this.orderPayments = this.normalizeOrderPayments(this.order?.payments || []);
    this.hydrateOrderItems(this.order);
  }

  // =============== Cargar Orden y Productos ===============
  fetch(id: string) {
    this.loading = true; this.error = ''; this.order = null;
    this.orderSplits = [];
    this.splitRemainingItems = [];
    this.splitsLoaded = false;
    this.ordersSvc.getById(id).subscribe({
      next: (res: any) => {
        this.order = res?.message?.data || res?.data || null;
        this.loading = false;
        if (!this.order) {
          this.error = 'Orden no encontrada';
          return;
        }
        this.orderCustomerId = this.getOrderCustomerId(this.order);
        this.orderPayments = this.normalizeOrderPayments(this.order?.payments || []);
        this.hydrateOrderItems(this.order);
        if (this.supportsSplits) this.loadOrderSplits();
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar la orden';
      }
    });
  }

  loadProducts(): void {
    this.productsSvc.getAll(1).subscribe({
      next: (res: any) => {
        const all = (res?.message?.data || []) as Product[];
        this.products = all.filter((p: any) => Number((p as any).isactive) === 1);
      },
      error: () => toast.error('Error al cargar la lista de productos.')
    });
  }

  private hydrateOrderItems(order: any): void {
    // Tu JSON ya trae por ítem: quantity, price, tax_rate, subtotal (SIN IVA), iva, total (CON IVA)
    // Para edición homogénea con invoicing, trabajamos con total = subtotal SIN IVA y tax_value = tax_rate.
    const items = order?.items || [];
    this.orderItems = items.map((it: any): OrderItem => ({
      rowName: it.name,
      notes: it.notes || '',
      productId: it.product ?? it.item ?? it.productId,
      productName: it.item_name ?? it.product_name ?? it.productName ?? it.nombre,
      description: it.item_name ?? it.product_name ?? it.productName ?? it.nombre,
      quantity: this.safeNumber(it.qty ?? it.quantity, 1),
      price: this.safeMoney(it.rate ?? it.price),
      tax: null,
      tax_value: it.tax_rate ?? 0,
      discount: this.safeMoney(it.discount_amount, 0),
    }));
    this.recalculateOrder();
  }

  // =================== Acciones PDF ===================
  getComandaPdf() {
    if (!this.order?.name) {
      toast.error('Orden inválida');
      return
    }
    const url = this.baseUrl + this.printSvc.getComanda(this.order.name);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }
  getRecibo() {
    if (!this.order?.name) {
      toast.error('Orden inválida');
      return
    }
    const url = this.baseUrl + this.printSvc.getRecibo(this.order.name);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }
  getFacturaPdf(): void {
    const inv = this.order?.sri?.invoice;
    if (!inv) {
      toast.error('Factura no disponible');
      return
    }
    const url = this.baseUrl + this.printSvc.getFacturaPdf(inv);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }

  // =================== Navegación ===================
  get sriStatus(): string {
    const st = this.order?.sri?.status;
    return st === 'AUTORIZADO' ? 'AUTORIZADO' :
      st === 'Rejected' ? 'Rechazada' :
        st === 'Error' ? 'Error' :
          st === 'Queued' ? 'En cola' :
            st === 'Processing' ? 'En proceso' :
              st === 'Draft' ? 'Borrador' :
                (st || 'Sin factura');
  }

  goBack() {
    if (window.history.length > 2) history.back();
    else this.router.navigate(['/orders']);
  }

  goToInvoice(invName?: string) {
    if (!invName) return;
    this.router.navigate(['/dashboard/invoices', invName]);
  }

  async emitirFacturaOrden(): Promise<void> {
    if (!this.order?.name || this.orderInvoiceEmitting) return;
    if (this.emissionBlockMessage) {
      toast.error(this.emissionBlockMessage);
      return;
    }
    if (!this.canCreateInvoice) {
      toast.error(this.isCancelled
        ? 'No se puede facturar una orden cancelada.'
        : 'La orden ya tiene una factura asociada o no tiene permisos para facturar.');
      return;
    }
    if (!this.belongsToActiveBusiness(this.order)) {
      toast.error('La orden no pertenece al negocio seleccionado.');
      return;
    }
    if (this.hasSplits) {
      toast.error('Esta orden se cobra por subcuentas: factura cada subcuenta.');
      return;
    }
    if (this.hasUnsavedInvoiceChanges) {
      toast.info('Guarda los cambios de cliente o ítems antes de facturar la orden.');
      return;
    }
    if (this.isCurrentOrderFinalConsumer() && this.orderTotal > 50) {
      toast.error('No se puede emitir una factura a CONSUMIDOR FINAL por un valor superior a USD 50 IVA incluido. Seleccione un cliente identificado.');
      return;
    }

    const confirmation = await this.alertService.confirm(
      'Se emitirá la factura con el cliente e ítems actuales de la orden. Esta acción no permite modificar la orden.',
      'Facturar orden'
    );
    if (!confirmation.isConfirmed) return;

    const orderName = this.order.name;
    this.orderInvoiceEmitting = true;
    this.ordersSvc.emitInvoiceForOrder(orderName)
      .pipe(finalize(() => this.orderInvoiceEmitting = false))
      .subscribe({
        next: (response: any) => {
          const message = response?.message ?? response ?? {};
          const data = message?.data ?? response?.data ?? {};
          const emission = message?.emission ?? data?.emission ?? {};
          const status = this.normalizeStatus(emission?.status ?? data?.provider_status ?? data?.status);
          const linkedInvoice = data?.lite_invoice ?? data?.order?.lite_invoice ?? data?.invoice ?? data?.sri?.invoice;
          const invoice = String(
            typeof linkedInvoice === 'object' ? linkedInvoice?.name : linkedInvoice || ''
          ).trim();

          if (status === 'authorized' || status === 'autorizada') {
            toast.success('Factura autorizada por el SRI.');
          } else if (status.includes('processing') || status.includes('proces') || status.includes('pendiente') || String(emission?.code || '') === '70') {
            toast.info('La factura fue recibida y está pendiente de autorización. Consulta su estado; no la emitas nuevamente.');
          } else if (status.includes('rechaz') || status.includes('not authorized')) {
            toast.error(this.getEmissionMessage(emission, data) || 'La factura fue rechazada. Revisa el detalle para reintentar si corresponde.');
          } else if (status.includes('error')) {
            toast.error(this.getEmissionMessage(emission, data) || 'Ocurrió un error al emitir la factura.');
          } else {
            toast.success('Solicitud de facturación procesada.');
          }

          this.fetch(orderName);
          if (invoice) this.router.navigate(['/dashboard/invoices', invoice]);
        },
        error: (error) => toast.error(this.extractBackendError(error))
      });
  }

  private loadCustomers(): void {
    this.customersSvc.getAll(1).subscribe({
      next: (customers: any[]) => {
        this.customers = (Array.isArray(customers) ? customers : []).map((customer: any) => ({
          ...customer,
          nombre: customer?.nombre || customer?.customer_name || customer?.fullName || customer?.name
        }));
      },
      error: () => { this.customers = []; }
    });
  }

  // =================== Edición de Ítems ===================
  addProductToOrder(productSelection: Product | string | null): void {
    const product = this.resolveProduct(productSelection);
    if (!product) return;
    if (this.isProductBlocked(product)) {
      toast.warning('Este producto esta agotado y no se puede agregar.');
      return;
    }

    const existing = this.orderItems.find(oi => oi.productId === product.name);
    if (existing) {
      existing.quantity = this.safeNumber(existing.quantity, 0) + 1;
    } else {
      const price = this.safeMoney(product.precio);
      const inferredTaxValue = product.tax_value ?? (product.tax === 'IVA-15' ? 15 : 0);

      this.orderItems.push({
        productId: product.name,
        productName: product.nombre,
        description: product.nombre,
        quantity: 1,
        price,
        tax: product.tax ?? product.tax_id ?? null,
        tax_value: inferredTaxValue,
        iva: this.round2(this.round2(price * (inferredTaxValue / 100))),
        total: this.round2(price) // subtotal sin IVA
      });
    }
    this.recalculateOrder();
  }

  incrementOrderQty(i: number): void {
    const it = this.orderItems[i];
    it.quantity = this.safeNumber(it.quantity, 0) + 1;
    this.recalculateOrder();
  }

  decrementOrderQty(i: number): void {
    const it = this.orderItems[i];
    it.quantity = Math.max(1, this.safeNumber(it.quantity, 1) - 1);
    this.recalculateOrder();
  }

  removeProductFromOrder(i: number): void {
    if (i < 0 || i >= this.orderItems.length) return;
    this.orderItems.splice(i, 1);
    this.recalculateOrder();
  }

  /** Recalcula cada línea en centavos con el mismo redondeo que la factura Lite. */
  recalculateOrder(): void {
    this.orderItems.forEach(it => {
      const qty = Math.max(1, this.safeNumber(it.quantity, 1));
      const rate = Math.max(0, this.safeMoney(it.price));
      it.quantity = qty;
      it.price = rate;
      it.cents = lineTotalsCents(qty, rate, it.discount ?? 0, this.getTaxPct(it) * 100);
      it.total = fromCents(it.cents.taxable); // subtotal SIN IVA, ya con descuento
      it.iva = fromCents(it.cents.tax);
    });
  }

  // =================== Totales (sumados en centavos) ===================
  private sumCents(pick: (line: LineCents) => number): number {
    return this.orderItems.reduce((acc, it) => acc + pick(it.cents ?? lineTotalsCents(it.quantity, it.price, it.discount ?? 0, this.getTaxPct(it) * 100)), 0);
  }

  get orderSubtotal(): number {
    return fromCents(this.sumCents((line) => line.taxable));
  }

  get orderIva(): number {
    return fromCents(this.sumCents((line) => line.tax));
  }

  get orderTotal(): number {
    return fromCents(this.sumCents((line) => line.total));
  }

  get orderDiscount(): number {
    return fromCents(this.orderItems.reduce((acc, it) => acc + toCents(it.discount ?? 0), 0));
  }

  get pendingOrderToSplit(): number {
    const splitCents = (this.orderSplits || []).reduce((acc, row) => acc + toCents(row?.total ?? 0), 0);
    return fromCents(Math.max(0, toCents(this.orderTotal) - splitCents));
  }

  get canOpenSplit(): boolean {
    return this.supportsSplits
      && this.canCreateSplit
      && !this.isCancelled
      && !this.isLocked
      && this.splitItemsSource.some((item: any) => this.safeNumber(item?.remaining_qty ?? item?.qty ?? item?.quantity, 0) > 0);
  }

  get canShowCreateInvoice(): boolean {
    return !!this.order?.name
      && !this.isCancelled
      && !this.isLocked
      && this.capabilities.isEnabled('orders')
      && (this.capabilities.isEnabled('billing') || this.capabilities.isEnabled('direct_invoice'))
      && this.capabilities.hasPermission('billing.create');
  }

  get currentFiscalLocation(): any | null {
    return this.capabilities.activeFiscalLocation;
  }

  get posTerminalBlockMessage(): string | null {
    return this.capabilities.getPosTerminalBlockMessage();
  }

  get terminalAssignmentLabel(): string {
    return this.currentFiscalLocation?.terminal && this.capabilities.terminalAccessRequired ? 'Asignado a tu usuario' : '';
  }

  /** Mismo control de emisión que el POS: permiso, plan, firma, configuración, cupo y terminal. */
  get emissionBlockMessage(): string | null {
    return this.capabilities.getEmissionBlockMessage({ feature: 'billing', requireTerminal: true });
  }

  get canCreateInvoice(): boolean {
    return this.canShowCreateInvoice && !this.isLocked && !this.emissionBlockMessage;
  }

  get createInvoiceBlockedReason(): string {
    if (!this.canShowCreateInvoice) return '';
    if (this.isLocked) return 'La orden ya tiene facturacion asociada.';
    return this.emissionBlockMessage || '';
  }

  get splitItemsSource(): any[] {
    // Una vez consultado el backend, `remaining` es la única fuente válida
    // para evitar asignar una fila dos veces.
    if (this.splitsLoaded) {
      return this.splitRemainingItems;
    }
    return Array.isArray(this.order?.items) ? this.order.items : [];
  }

  // =================== Guardado ===================
  saveOrderChanges(): void {
  if (this.savingOrderChanges) return;
  if (!this.canEditOrder) {
    toast.error(this.isClosed ? 'La orden ya está cerrada.' : 'La orden ya está facturada.');
    return;
  }
  if (!this.order?.name) { toast.error('Orden no válida'); return; }

  const items = this.orderItems.map(it => {
    const qty = this.safeNumber(it.quantity, 1);
    const rate = this.safeMoney(it.price);
    const lineSubtotal = this.round2(qty * rate);       // SIN IVA
    const taxRate = Number.isFinite(it.tax_value as number)
      ? (it.tax_value as number)
      : (it.tax === 'IVA-15' ? 15 : 0);

    return {
      // La fila existente se identifica para conservar su precio y su nota de cocina.
      ...(it.rowName ? { order_item: it.rowName } : {}),
      product:   it.productId || 'ADHOC',
      qty,
      // El backend solo respeta el precio enviado para Gerente/Administrador.
      ...(this.canEditPrice ? { rate: this.round2(rate) } : {}),
      // Se reenvía el descuento puesto en el POS para no perderlo al guardar.
      discount_amount: this.safeMoney(it.discount ?? 0),
      tax:       it.tax ?? null,
      total:     lineSubtotal,                    // subtotal SIN IVA
      tax_rate:  taxRate
    };
  });

  const payload = {
    order_name: this.order.name,
    customer: this.orderCustomerId || this.getOrderCustomerId(this.order),
    alias: this.order?.alias || '',
    items,
    payments: this.orderPayments,
    notes: this.order?.notes || this.order?.observaciones || ''
  };

  if (!payload.customer) {
    toast.error('Debes seleccionar un cliente activo para la orden.');
    return;
  }

  const paymentValidation = validatePaymentsTotal(
    this.orderPayments.map((payment: any) => ({
      formas_de_pago: payment.payment_method,
      monto: payment.amount
    })),
    this.orderTotal
  );
  if (paymentValidation) {
    toast.error(paymentValidation);
    return;
  }

  this.savingOrderChanges = true;
  this.ordersSvc.updateOrderForInvoice(payload)
    .pipe(finalize(() => this.savingOrderChanges = false))
    .subscribe({
    next: () => {
      toast.success('Orden actualizada.');
      this.loadProducts();
      if (this.order?.name) {
        this.fetch(this.order.name);
      }
    },
    error: (error) => toast.error(this.extractBackendError(error))
  });

}

  async closeOrder(): Promise<void> {
    if (!this.order?.name) {
      toast.error('Orden no válida.');
      return;
    }
    if (this.isClosed) {
      toast.info('La orden ya está cerrada.');
      return;
    }
    if (this.isLocked) {
      toast.info('La orden ya está bloqueada por facturación.');
      return;
    }
    if (this.closingOrder) return;

    const result = await this.alertService.confirm(
      'Al cerrar la orden ya no se podrán agregar, eliminar ni editar productos. Si tienes cambios pendientes, guarda antes de cerrarla.',
      'Cerrar orden'
    );

    if (!result.isConfirmed) return;

    const orderName = this.order.name;
    this.closingOrder = true;
    this.ordersSvc.updateStatus(orderName, 'Cerrada', this.order?.status)
      .pipe(finalize(() => this.closingOrder = false))
      .subscribe({
        next: () => {
          toast.success('Orden cerrada. Ya no se podrán hacer cambios.');
          if (this.order) {
            this.order.status = 'Cerrada';
          }
          window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
          this.fetch(orderName);
        },
        error: (error) => toast.error(this.extractBackendError(error))
      });
  }



  // =================== Presentación ===================
  trackByIndex = (i: number) => i;

  /** Solo Gerente/Administrador cambian precios (el backend aplica la misma regla). */
  get canEditPrice(): boolean {
    return this.canEditOrder && this.capabilities.hasPermission('restaurant.manage');
  }

  /** Con subcuentas creadas, los productos no se editan: cambiarían lo ya dividido. */
  get canEditItems(): boolean {
    return this.canEditOrder && !this.orderSplits.length;
  }

  get hasSplits(): boolean {
    return this.orderSplits.length > 0;
  }

  /** Facturar la orden completa solo si no se está cobrando por subcuentas. */
  get canInvoiceWholeOrder(): boolean {
    return this.canShowCreateInvoice && !this.hasSplits;
  }

  get splitProgressPct(): number {
    if (this.orderTotal <= 0) return 0;
    return Math.min(100, Math.round(((this.orderTotal - this.pendingOrderToSplit) / this.orderTotal) * 100));
  }

  get invoicedSplitsCount(): number {
    return this.orderSplits.filter((row) => this.splitHasInvoice(row)).length;
  }

  /** Índice de la etapa actual en `progressSteps` (-1 si está cancelada). */
  get progressIndex(): number {
    if (this.isCancelled) return -1;
    if (this.isLocked) return 4;
    const label = this.orderStatusLabel;
    const index = this.progressSteps.indexOf(label);
    return index >= 0 ? index : 0;
  }

  /** Lo primero que identifica a la orden en el salón: alias o mesa. */
  get orderHeadline(): string {
    // `table` llega como ID interno; el alias es lo que el personal reconoce.
    const alias = String(this.order?.alias || '').trim();
    return alias || `Orden ${this.order?.name || ''}`.trim();
  }

  get customerName(): string {
    return this.order?.customer?.customer_name || this.order?.customer?.nombre || this.order?.customer_name
      || this.order?.nombre_cliente || 'Consumidor final';
  }

  get customerIdentification(): string {
    return this.order?.customer?.identification_number || this.order?.customer?.num_identificacion
      || this.order?.customer_identification_number || this.order?.identificacion_cliente || '';
  }

  get customerEmail(): string {
    return this.order?.customer?.email || this.order?.customer?.correo || this.order?.customer_email || this.order?.correo_cliente || '';
  }

  get customerPhone(): string {
    return this.order?.customer?.phone || this.order?.customer?.telefono || this.order?.customer_phone || this.order?.telefono_cliente || '';
  }

  readonly paymentReferenceMaxLength = PAYMENT_REFERENCE_MAX_LENGTH;

  /** Las transferencias muestran un campo para su número (opcional). */
  isTransferMethod(method: string): boolean {
    return isTransferPayment(this.paymentMethods, method);
  }

  get paymentsTotal(): number {
    return this.round2(this.orderPayments.reduce((acc, payment) => acc + this.safeNumber(payment?.amount, 0), 0));
  }

  get paymentsDifference(): number {
    return this.round2(this.orderTotal - this.paymentsTotal);
  }

  get paymentsDifferenceLabel(): string {
    const diff = this.paymentsDifference;
    if (diff === 0) return 'Los pagos cuadran con el total.';
    return `${diff > 0 ? 'Faltan' : 'Sobran'} $${Math.abs(diff).toFixed(2)} para cuadrar con el total.`;
  }

  /** Completa el monto del único pago con el total (caso más común: un solo método). */
  fillPaymentWithTotal(payment: any): void {
    const others = this.orderPayments.filter((row) => row !== payment)
      .reduce((acc, row) => acc + this.safeNumber(row?.amount, 0), 0);
    payment.amount = Math.max(0, this.round2(this.orderTotal - others));
  }

  /** Vuelve a los datos guardados de la orden, descartando ediciones locales. */
  discardChanges(): void {
    if (!this.order) return;
    this.orderCustomerId = this.getOrderCustomerId(this.order);
    this.orderPayments = this.normalizeOrderPayments(this.order?.payments || []);
    this.hydrateOrderItems(this.order);
    this.showCustomerPicker = false;
  }

  printAndClose(kind: 'comanda' | 'recibo' | 'factura'): void {
    this.showMoreActions = false;
    if (kind === 'comanda') this.getComandaPdf();
    else if (kind === 'recibo') this.getRecibo();
    else this.getFacturaPdf();
  }

  // =================== Helpers ===================

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

  private getTaxPct(it: OrderItem): number {
    if (Number.isFinite(it.tax_value as number)) {
      return Math.max(0, (it.tax_value as number) / 100); // 15 -> 0.15
    }
    return it.tax === 'IVA-15' ? 0.15 : 0;
  }

  openSplitDialog(): void {
    if (!this.order?.name) return;
    if (!this.canCreateSplit) {
      toast.error('No tiene permisos para dividir esta cuenta.');
      return;
    }
    if (this.isCancelled) {
      toast.error('No se puede dividir una orden cancelada.');
      return;
    }
    if (this.isLocked) {
      toast.info('No se puede dividir una orden facturada.');
      return;
    }
    this.showSplitDialog = true;
    this.loadOrderSplits();
  }

  closeSplitDialog(): void {
    if (this.splitSubmitting) return;
    this.showSplitDialog = false;
  }

  createSplit(payload: SplitOrderPayload): void {
    if (this.splitSubmitting || !this.canOpenSplit) return;
    if (!this.belongsToActiveBusiness(this.order)) {
      toast.error('La orden no pertenece al negocio seleccionado.');
      return;
    }
    if (payload.customer && !this.belongsToActiveBusiness(this.order?.customer_data)) {
      toast.error('El cliente no pertenece al negocio seleccionado.');
      return;
    }

    this.splitSubmitting = true;
    this.orderSplitSvc.splitOrder(payload)
      .pipe(finalize(() => { this.splitSubmitting = false; }))
      .subscribe({
        next: () => {
          toast.success('Subcuenta creada correctamente.');
          this.showSplitDialog = false;
          if (this.order?.name) this.fetch(this.order.name);
          else this.loadOrderSplits();
        },
        error: (e) => {
          toast.error(this.extractBackendError(e));
        }
      });
  }

  invoiceSplit(row: OrderSplitRow): void {
    if (!row?.name || this.splitActionLoadingName || this.splitDeleteLoadingName) return;
    if (!this.canInvoiceSplit) {
      toast.error('No tiene permisos para facturar una cuenta dividida.');
      return;
    }
    if (this.emissionBlockMessage) {
      toast.error(this.emissionBlockMessage);
      return;
    }
    if (this.splitHasInvoice(row)) {
      toast.info('Esta cuenta ya tiene una factura asociada.');
      return;
    }

    const payments = this.getValidatedSplitPayments(row);
    if (!payments) return;

    this.splitActionLoadingName = row.name;
    this.orderSplitSvc.createAndEmitFromSplit(row.name, payments)
      .pipe(finalize(() => { this.splitActionLoadingName = ''; }))
      .subscribe({
        next: (response: any) => {
          this.showSplitEmissionResult(response);
          if (this.order?.name) {
            this.fetch(this.order.name);
          } else {
            this.loadOrderSplits();
          }
        },
        error: (e) => {
          toast.error(this.extractBackendError(e));
        }
      });
  }

  /** Cada persona puede facturar su subcuenta a su propio nombre. */
  changeSplitCustomer(event: { row: OrderSplitRow; customer: any }): void {
    const splitName = event?.row?.name;
    const customer = String(event?.customer?.name || '').trim();
    if (!splitName || !customer || this.splitCustomerSavingName) return;
    if (this.splitHasInvoice(event.row)) {
      toast.info('La subcuenta ya fue facturada; su cliente no se puede cambiar.');
      return;
    }
    this.splitCustomerSavingName = splitName;
    this.orderSplitSvc.updateSplitCustomer(splitName, customer)
      .pipe(finalize(() => { this.splitCustomerSavingName = ''; }))
      .subscribe({
        next: () => {
          toast.success('Cliente de la subcuenta actualizado.');
          this.loadOrderSplits();
        },
        error: (e) => toast.error(this.extractBackendError(e))
      });
  }

  deleteSplit(row: OrderSplitRow): void {
    if (!row?.name || this.splitActionLoadingName || this.splitDeleteLoadingName) return;
    if (!this.canDeleteSplit) {
      toast.error('No tiene permisos para eliminar una cuenta dividida.');
      return;
    }
    if (this.splitHasInvoice(row)) {
      toast.error('No se puede eliminar una cuenta que ya tiene factura.');
      return;
    }

    const splitLabel = row?.split_label || row?.alias || row?.name;
    const ok = window.confirm(`¿Eliminar la subcuenta "${splitLabel}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    this.splitDeleteLoadingName = row.name;
    this.orderSplitSvc.deleteOrderSplit(row.name)
      .pipe(finalize(() => { this.splitDeleteLoadingName = ''; }))
      .subscribe({
        next: () => {
          toast.success('Subcuenta eliminada correctamente.');
          if (this.order?.name) this.fetch(this.order.name);
          else this.loadOrderSplits();
        },
        error: (e) => {
          toast.error(this.extractBackendError(e));
        }
      });
  }

  private loadOrderSplits(): void {
    if (!this.order?.name) {
      this.orderSplits = [];
      this.splitRemainingItems = [];
      this.splitsLoaded = false;
      return;
    }

    const orderName = this.order.name;
    this.splitsLoading = true;
    this.orderSplitSvc.getOrderSplits(orderName)
      .pipe(finalize(() => { this.splitsLoading = false; }))
      .subscribe({
        next: (res) => {
          if (this.order?.name !== orderName) return;
          const mapped = this.mapSplitsResponse(res);
          this.orderSplits = mapped.splits;
          this.splitRemainingItems = mapped.remaining;
          this.splitsLoaded = true;
        },
        error: (e) => {
          if (this.order?.name !== orderName) return;
          this.orderSplits = [];
          this.splitRemainingItems = [];
          this.splitsLoaded = false;
          toast.error(this.extractBackendError(e));
        }
      });
  }

  private loadPaymentMethods(): void {
    this.paymentsSvc.getAll().subscribe({
      next: (res: any[]) => {
        this.paymentMethods = (Array.isArray(res) ? res : []).map((payment: any) => ({
          ...payment,
          name: payment.name || payment.codigo,
          description: payment.description || payment.nombre || payment.name || payment.codigo
        }));
      },
      error: (e) => {
        this.paymentMethods = [];
        toast.error(this.extractBackendError(e));
      }
    });
  }

  private getValidatedSplitPayments(row: OrderSplitRow): InvoicePaymentPayload[] | null {
    const total = roundMoney(row?.total ?? row?.sri?.grand_total ?? 0);
    const payments: InvoicePaymentPayload[] = (row?.payments || []).map((payment: any) => ({
      formas_de_pago: String(payment?.formas_de_pago || payment?.payment_method || payment?.method || '').trim(),
      monto: roundMoney(payment?.monto ?? payment?.amount)
    }));

    const validationError = validatePaymentsTotal(payments, total);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    return payments;
  }

  private mapSplitsResponse(res: any): { splits: OrderSplitRow[]; remaining: any[] } {
    const payload = res?.message?.data ?? res?.data ?? res?.message ?? res ?? {};

    const splitsRaw =
      (Array.isArray(payload?.splits) && payload.splits) ||
      (Array.isArray(payload) && payload) ||
      (Array.isArray(payload?.data) && payload.data) ||
      (Array.isArray(res?.data) && res.data) ||
      [];

    const remaining =
      (Array.isArray(payload?.remaining) && payload.remaining) ||
      (Array.isArray(res?.remaining) && res.remaining) ||
      [];

    const activeBusiness = String(this.capabilities.activeBusinessId || '').trim();
    const splits = (splitsRaw as any[])
      .filter((row: any) => {
        const rowBusiness = String(row?.business || '').trim();
        return !rowBusiness || rowBusiness === activeBusiness;
      })
      .map((row: any) => {
        // Cada subcuenta es un documento monetario: sus totales se trabajan
        // siempre en centavos. El backend puede entregar fracciones internas
        // (p. ej. 23.125); no se deben sumar crudas si la UI muestra 23.13.
        const subtotal = this.safeMoney(row?.subtotal ?? row?.total_without_tax ?? row?.net_total, 0);
        const iva = this.safeMoney(row?.iva ?? row?.total_taxes ?? row?.tax_amount, 0);
        const rawTotal = this.safeNumber(row?.total ?? row?.grand_total, Number.NaN);
        const total = Number.isFinite(rawTotal) ? this.round2(rawTotal) : this.round2(subtotal + iva);
        const payments = Array.isArray(row?.payments)
          ? row.payments.map((payment: any) => {
              const amount = this.safeMoney(payment?.monto ?? payment?.amount, 0);
              return { ...payment, monto: amount, amount };
            })
          : [];

        return {
          ...row,
          subtotal,
          iva,
          total,
          payments,
          invoice: row?.lite_invoice || row?.sales_invoice || row?.invoice || row?.factura || null,
          lite_invoice: row?.lite_invoice || row?.sales_invoice || row?.invoice || row?.factura || null,
          customer_name: row?.customer_name ?? row?.customer_data?.customer_name ?? row?.customer_data?.nombre,
          customer_identification_number: row?.customer_identification_number ?? row?.customer_data?.identification_number ?? row?.customer_data?.num_identificacion,
          provider_status: row?.provider_status ?? row?.electronic?.provider_status,
          sri_message: row?.sri_message ?? row?.electronic?.sri_message,
          sri: row?.sri ?? {
            status: row?.sri_status ?? row?.provider_status,
            invoice: row?.lite_invoice || row?.sales_invoice || row?.invoice || row?.factura,
            access_key: row?.access_key ?? row?.electronic?.access_key
          }
        };
      });

    return { splits, remaining };
  }

  private extractBackendError(error: any): string {
    const payload = error?.error || error || {};

    // 1) Frappe suele devolver _server_messages como JSON string de array de strings JSON.
    const serverMessagesRaw = payload?._server_messages;
    if (serverMessagesRaw) {
      try {
        const outer = typeof serverMessagesRaw === 'string' ? JSON.parse(serverMessagesRaw) : serverMessagesRaw;
        if (Array.isArray(outer) && outer.length) {
          const first = typeof outer[0] === 'string' ? JSON.parse(outer[0]) : outer[0];
          const message = first?.message;
          if (message) return String(message);
        }
      } catch {
        // continue with next fallback
      }
    }

    // 2) Exception completa de Frappe: "frappe.exceptions.ValidationError: Mensaje"
    const exception = payload?.exception;
    if (typeof exception === 'string' && exception.includes(':')) {
      return exception.split(':').slice(1).join(':').trim();
    }

    // 3) Mensajes estándar
    if (payload?.message) return String(payload.message);
    if (payload?.exc_type && payload?.exc) return `${payload.exc_type}`;
    if (error?.message) return String(error.message);

    return 'Error inesperado.';
  }

  private getOrderCustomerId(order: any): string {
    return String(
      order?.customer?.name
      || order?.customer_data?.name
      || (typeof order?.customer === 'string' ? order.customer : '')
      || ''
    ).trim();
  }

  /** Validación preventiva; el backend conserva la validación definitiva. */
  private isCurrentOrderFinalConsumer(): boolean {
    const customerId = this.orderCustomerId || this.getOrderCustomerId(this.order);
    const selected = this.customers.find((customer: any) => String(customer?.name || '') === customerId);
    const source = selected || this.order?.customer_data || this.order?.customer || {};
    const identificationType = String(
      source?.identification_type ?? source?.tipo_identificacion ?? this.order?.tipo_identificacion_cliente ?? ''
    ).trim().toLocaleLowerCase();
    const identificationNumber = String(
      source?.identification_number ?? source?.num_identificacion ?? this.order?.identificacion_cliente ?? ''
    ).trim();
    return identificationType.includes('consumidor final') || identificationNumber === '9999999999999';
  }

  private normalizeOrderPayments(payments: any[]): any[] {
    return (Array.isArray(payments) ? payments : []).map((payment: any) => ({
      payment_method: String(payment?.payment_method || payment?.formas_de_pago || payment?.method || '').trim(),
      payment_code: String(payment?.payment_code || payment?.forma_pago || payment?.codigo || '').trim(),
      amount: this.round2(this.safeNumber(payment?.amount ?? payment?.monto, 0)),
      reference: String(payment?.reference || '').trim()
    }));
  }

  private safeNumber(v: any, def = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  private safeMoney(v: any, def = 0): number {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? this.round2(n) : def;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  get isLocked(): boolean {
  // Elige la condición que prefieras:
  // A) bloquear si es de tipo Factura
  // return this.order?.type === 'Factura';
  // B) bloquear si ya fue AUTORIZADA en SRI (recomendado)
    const linkedInvoice = String(
      this.order?.sri?.invoice ||
      this.order?.lite_invoice ||
      this.order?.sales_invoice ||
      this.order?.invoice ||
      this.order?.factura ||
      ''
    ).trim();

    return !!linkedInvoice
      || this.normalizeStatus(this.order?.fiscal_status) === 'factura'
      // Compatibilidad con órdenes antiguas. El contrato nuevo usa
      // `fiscal_status` y `lite_invoice`; un estado SRI aislado no debe
      // bloquear una orden que todavía no tiene comprobante asociado.
      || this.normalizeStatus(this.order?.estado) === 'factura'
      || this.order?.type === 'Factura';
}

  get isMesero(): boolean {
    return this.roleName === 'Mesero';
  }

  get isClosed(): boolean {
    const status = this.normalizeStatus(this.order?.status);
    return status.includes('cerr');
  }

  get isReadOnlyView(): boolean {
    return this.isMesero && this.isClosed;
  }

  get canEditOrder(): boolean {
    return !!this.order?.name
      && !this.isCancelled
      && !this.isLocked
      && this.capabilities.isEnabled('orders')
      && (this.capabilities.isEnabled('billing') || this.capabilities.isEnabled('direct_invoice'))
      && this.capabilities.hasPermission('billing.create')
      && ['GERENTE', 'CAJERO', 'FACTURACION', 'ADMINISTRADOR'].includes(this.currentBusinessRole);
  }

  get hasUnsavedInvoiceChanges(): boolean {
    if (!this.order) return false;
    if (this.orderCustomerId !== this.getOrderCustomerId(this.order)) return true;
    const originalItems = Array.isArray(this.order?.items) ? this.order.items : [];
    if (originalItems.length !== this.orderItems.length) return true;

    const itemsChanged = this.orderItems.some((item, index) => {
      const original = originalItems[index] || {};
      const originalProduct = String(original?.product || original?.item || original?.productId || '').trim();
      const originalQty = this.safeNumber(original?.qty ?? original?.quantity, 0);
      const originalRate = this.safeMoney(original?.rate ?? original?.price);
      const originalTax = this.safeNumber(original?.tax_rate ?? original?.tax_value, 0);
      return String(item.productId || '').trim() !== originalProduct
        || this.safeNumber(item.quantity, 0) !== originalQty
        || this.safeMoney(item.price) !== originalRate
        || this.safeNumber(item.tax_value, 0) !== originalTax;
    });
    if (itemsChanged) return true;

    const originalPayments = this.normalizeOrderPayments(this.order?.payments || []);
    if (originalPayments.length !== this.orderPayments.length) return true;
    return this.orderPayments.some((payment: any, index: number) => {
      const original = originalPayments[index] || {};
      return payment.payment_method !== original.payment_method
        || payment.payment_code !== original.payment_code
        || this.round2(this.safeNumber(payment.amount, 0)) !== this.round2(this.safeNumber(original.amount, 0))
        || String(payment.reference || '') !== String(original.reference || '');
    });
  }

  addOrderPayment(): void {
    const defaultPayment = this.paymentMethods.find((method: any) => !isPaymentMethodAlreadySelected(
      this.paymentMethods,
      this.orderPayments.map((payment: any) => ({ method: payment.payment_method })),
      method?.name || method?.codigo
    ));
    if (!defaultPayment) {
      toast.warning('No hay más métodos de pago disponibles para agregar.');
      return;
    }
    this.orderPayments.push({
      payment_method: defaultPayment?.name || '',
      payment_code: defaultPayment?.codigo || '',
      amount: 0,
      reference: ''
    });
  }

  removeOrderPayment(index: number): void {
    this.orderPayments.splice(index, 1);
  }

  onOrderPaymentMethodChange(payment: any, index = -1): void {
    if (isPaymentMethodAlreadySelected(
      this.paymentMethods,
      this.orderPayments.map((row: any) => ({ method: row.payment_method })),
      payment?.payment_method,
      index
    )) {
      payment.payment_method = '';
      payment.payment_code = '';
      toast.warning('No puedes repetir el mismo método de pago.');
      return;
    }
    const selected = this.paymentMethods.find((item: any) => item?.name === payment?.payment_method);
    payment.payment_code = selected?.codigo || selected?.payment_code || selected?.forma_pago || '';
  }

  isOrderPaymentMethodUsed(value: string, exceptIndex: number): boolean {
    return isPaymentMethodAlreadySelected(
      this.paymentMethods,
      this.orderPayments.map((payment: any) => ({ method: payment.payment_method })),
      value,
      exceptIndex
    );
  }

  private showSplitEmissionResult(response: any): void {
    const message = response?.message ?? response ?? {};
    const data = message?.data ?? response?.data ?? {};
    const emission = message?.emission ?? data?.emission ?? {};
    const rawStatus = String(emission?.status ?? data?.provider_status ?? data?.status ?? '');
    const normalizedStatus = this.normalizeStatus(rawStatus);
    const status = normalizedStatus === 'autorizada' || normalizedStatus === 'authorized'
      ? 'AUTHORIZED'
      : normalizedStatus === 'emitida' || normalizedStatus.includes('proces') || normalizedStatus.includes('pendiente')
        ? 'PROCESSING'
        : normalizedStatus === 'rechazada' || normalizedStatus === 'not authorized'
          ? 'NOT_AUTHORIZED'
          : normalizedStatus.includes('error')
            ? 'ERROR'
            : rawStatus.toUpperCase();
    const code = String(emission?.code ?? data?.sri_code ?? '').trim();
    const messages = Array.isArray(emission?.messages) ? emission.messages : [];
    const detail = messages.map((item: any) => typeof item === 'string'
      ? item
      : (item?.message || item?.description || item?.text || '')
    ).filter(Boolean).join(' ') || emission?.message || data?.sri_message || data?.emission_error || '';
    if (status === 'AUTHORIZED') {
      toast.success(`Factura autorizada${data?.lite_invoice ? `: ${data.lite_invoice}` : ''}.`);
    } else if (status === 'PROCESSING' || code === '70') {
      toast.info('La cuenta fue recibida y continúa en procesamiento. Consulte nuevamente la autorización.');
    } else if (status === 'NOT_AUTHORIZED') {
      toast.error(detail || 'La factura de la cuenta no fue autorizada.');
    } else if (status === 'ERROR') {
      toast.error(detail || 'Ocurrió un error al emitir la cuenta.');
    } else {
      toast.success('Solicitud de facturación enviada.');
    }
  }

  private getEmissionMessage(emission: any, data: any): string {
    const messages = Array.isArray(emission?.messages) ? emission.messages : [];
    return messages.map((item: any) => typeof item === 'string'
      ? item
      : (item?.message || item?.description || item?.text || '')
    ).filter(Boolean).join(' ')
      || emission?.message
      || data?.sri_message
      || data?.emission_error
      || '';
  }

  private belongsToActiveBusiness(record: any): boolean {
    const active = String(this.capabilities.activeBusinessId || '').trim();
    const business = String(record?.business || '').trim();
    return !!active && (!business || business === active);
  }

  get canCloseOrder(): boolean {
    const status = this.normalizeStatus(this.order?.status);
    return !!this.order?.name && !this.isLocked && this.capabilities.hasPermission('restaurant.orders.update')
      && (status.includes('prepar') || status.includes('lista'));
  }

  get canStartPreparation(): boolean {
    return !!this.order?.name && !this.isLocked && this.capabilities.hasPermission('restaurant.orders.update')
      && this.normalizeStatus(this.order?.status).includes('ingres');
  }

  get canMarkReady(): boolean {
    return !!this.order?.name && !this.isLocked && this.capabilities.hasPermission('restaurant.orders.update')
      && this.normalizeStatus(this.order?.status).includes('prepar');
  }

  get canCancelOrder(): boolean {
    const status = this.normalizeStatus(this.order?.status);
    return !!this.order?.name && !this.isLocked && this.capabilities.hasPermission('restaurant.orders.update')
      && (status.includes('ingres') || status.includes('prepar') || status.includes('lista'));
  }

  get isCancelled(): boolean {
    return this.normalizeStatus(this.order?.status).includes('cancel');
  }

  get supportsSplits(): boolean {
    return this.capabilities.isEnabled('restaurant') && this.capabilities.isEnabled('orders') && !this.isKitchenRole;
  }

  get canCreateSplit(): boolean {
    return this.supportsSplits && ['MESERO', 'CAJERO', 'GERENTE', 'ADMINISTRADOR'].includes(this.currentBusinessRole);
  }

  get canInvoiceSplit(): boolean {
    return this.supportsSplits
      && (['CAJERO', 'GERENTE', 'ADMINISTRADOR', 'FACTURACION'].includes(this.currentBusinessRole))
      && (this.capabilities.isEnabled('billing') || this.capabilities.isEnabled('direct_invoice'))
      && this.capabilities.hasPermission('billing.create');
  }

  get canDeleteSplit(): boolean {
    return this.supportsSplits && ['CAJERO', 'GERENTE', 'ADMINISTRADOR'].includes(this.currentBusinessRole);
  }

  get isKitchenRole(): boolean {
    return this.currentBusinessRole === 'COCINA';
  }

  get currentBusinessRole(): string {
    return this.normalizeStatus(this.capabilities.businessRole || this.roleName).toUpperCase();
  }

  splitHasInvoice(row: OrderSplitRow | null | undefined): boolean {
    return !!String(row?.lite_invoice || row?.invoice || row?.sri?.invoice || '').trim();
  }

  setOrderStatus(status: 'Preparacion' | 'Lista' | 'Cancelada'): void {
    if (!this.order?.name || this.closingOrder || !this.capabilities.hasPermission('restaurant.orders.update')) {
      if (!this.capabilities.hasPermission('restaurant.orders.update')) toast.error('No tienes permisos para actualizar órdenes.');
      return;
    }
    if (!this.ordersSvc.canTransitionOrder(this.order.status, status)) {
      toast.error('No se puede cambiar la orden a ese estado desde su estado actual.');
      return;
    }
    this.closingOrder = true;
    this.ordersSvc.updateStatus(this.order.name, status, this.order.status)
      .pipe(finalize(() => this.closingOrder = false))
      .subscribe({
        next: () => {
          toast.success(status === 'Cancelada' ? 'Orden cancelada.' : `Orden marcada como ${status === 'Preparacion' ? 'en preparación' : 'lista'}.`);
          window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
          this.fetch(this.order.name);
        },
        error: (error) => toast.error(this.extractBackendError(error))
      });
  }

  get orderStatusLabel(): string {
    const normalized = this.normalizeStatus(this.order?.status);
    if (!normalized) return 'Sin estado';
    if (normalized.includes('ingres')) return 'Ingresada';
    if (normalized.includes('prepar')) return 'Preparación';
    if (normalized.includes('lista')) return 'Lista';
    if (normalized.includes('cerr') || normalized.includes('entreg')) return 'Cerrada';
    return String(this.order?.status || 'Sin estado');
  }

  get orderStatusClass(): string {
    // Opacidades en lugar de tonos fijos: legibles en tema claro y oscuro.
    if (this.isLocked) return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    const status = this.orderStatusLabel;
    if (status === 'Ingresada') return 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300';
    if (status === 'Preparación') return 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    if (status === 'Lista') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (status === 'Cerrada') return 'border-border bg-muted text-muted-foreground';
    if (status === 'Cancelada') return 'border-destructive/30 bg-destructive/10 text-destructive';
    return 'border-border bg-muted text-muted-foreground';
  }

  private detectRole(): 'Gerente' | 'Cajero' | 'Mesero' | 'Desconocido' {
    const raw = localStorage.getItem('user');
    if (!raw) return 'Desconocido';

    try {
      const user = JSON.parse(raw);
      const role = String(user?.roles?.[0] ?? '').toLowerCase();
      if (role.includes('mesero')) return 'Mesero';
      if (role.includes('cajero')) return 'Cajero';
      if (role.includes('gerente') || role.includes('admin')) return 'Gerente';
    } catch {
      return 'Desconocido';
    }

    return 'Desconocido';
  }

  private normalizeStatus(value: any): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private resolveProduct(productSelection: Product | string | null): Product | null {
    if (!productSelection) return null;
    if (typeof productSelection !== 'string') return productSelection;
    return this.products.find((item) => item.name === productSelection) || null;
  }

  productImage(productId: unknown): string {
    const product = this.products.find((item) => item.name === String(productId || '').trim());
    return String(product?.image_url || product?.image || '').trim();
  }
}
