import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs/operators';

import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { PrintService } from 'src/app/services/print.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from 'src/environments/environment';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { OrdersService } from 'src/app/services/orders.service';
import { OrderSplitService } from 'src/app/services/order-split.service';
import { OrderSplitRow, SplitOrderPayload } from 'src/app/services/order-split.types';
import { SplitOrderDialogComponent } from './components/split-order-dialog/split-order-dialog.component';
import { OrderSplitsTableComponent } from './components/order-splits-table/order-splits-table.component';
import { PaymentsService } from 'src/app/services/payments.service';
import { canSellProduct, getInventoryUnit, hasInventoryControl, isLowStockProduct, isOutOfStockProduct, toInventoryNumber } from 'src/app/shared/utils/inventory.utils';

type Product = any; // usa tu modelo si lo tienes
type OrderItem = {
  productId?: string;
  productName?: string;
  description?: string;
  quantity: number;
  price: number;
  tax?: string | null;
  tax_value?: number;  // 0 o 15
  iva?: number;
  total?: number;      // subtotal SIN IVA (como haces en invoicing)
};

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule,
    EcuadorTimePipe,
    FontAwesomeModule,
    ButtonComponent,
    SplitOrderDialogComponent,
    OrderSplitsTableComponent
  ],
  templateUrl: './order-detail-page.component.html'
})
export class OrderDetailPageComponent implements OnInit {
  loading = true;
  error = '';
  order: any | null = null;

  // UI/estado
  products: Product[] = [];
  orderItems: OrderItem[] = [];
  showCustomerModal = false;
  customerForm!: FormGroup;
  showSplitDialog = false;
  splitSubmitting = false;
  splitActionLoadingName = '';
  splitDeleteLoadingName = '';
  splitsLoading = false;
  orderSplits: OrderSplitRow[] = [];
  splitRemainingItems: any[] = [];
  paymentMethods: any[] = [];

  private baseUrl = environment.URL;
  roleName: 'Gerente' | 'Cajero' | 'Mesero' | 'Desconocido' = 'Desconocido';

  constructor(
    private route: ActivatedRoute,
    private invoicesSvc: InvoicesService,
    private productsSvc: ProductsService,
    private printSvc: PrintService,
    private router: Router,
    private fb: FormBuilder,
    private ordersSvc: OrdersService,
    private orderSplitSvc: OrderSplitService,
    private paymentsSvc: PaymentsService,
  ) { }

  ngOnInit(): void {
    this.roleName = this.detectRole();
    // modal cliente opcional
    this.customerForm = this.fb.group({
      nombre: [''],
      num_identificacion: [''],
      tipo_identificacion: ['05 - Cedula'],
      correo: [''],
      telefono: [''],
      direccion: ['']
    });

    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
    this.loadProducts();
    this.loadPaymentMethods();
  }

  // =============== Cargar Orden y Productos ===============
  fetch(id: string) {
    this.loading = true; this.error = ''; this.order = null;
    this.invoicesSvc.getOrderDetail(id).subscribe({
      next: (res: any) => {
        this.order = (res?.message?.data || res?.data);
        console.log('Orden cargada:', this.order);
        this.loading = false;
        if (!this.order) {
          this.error = 'Orden no encontrada';
          return;
        }
        this.hydrateOrderItems(this.order);
        this.loadOrderSplits();
      },
      error: (err) => {
        this.loading = false;
        this.error = 'No se pudo cargar la orden';
        console.error(err);
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
    console.log('Items originales de la orden:', items);
    this.orderItems = items.map((it: any): OrderItem => ({
      productId: it.productId,
      productName: it.productName,
      description: it.productName,
      quantity: this.safeNumber(it.quantity, 1),
      price: this.safeMoney(it.price),
      tax: null,
      tax_value: it.tax_rate ?? 0,
      iva: this.safeMoney(
        it.iva,
        this.round2(this.safeNumber(it.quantity, 1) * this.round2(this.safeMoney(it.price) * ((it.tax_rate ?? 0) / 100)))
      ),
      total: this.round2(this.safeNumber(it.subtotal, this.safeNumber(it.quantity, 1) * this.safeMoney(it.price)))
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
    this.router.navigate(['/invoices', invName]);
  }

  facturarDesdeOrden(order: any) {
    if (!this.canCreateInvoice) {
      toast.error(this.createInvoiceBlockedReason || 'La orden ya esta facturada.');
      return;
    }
    if (!order?.name) return;
    this.router.navigate(['/dashboard/invoicing', order.name]);
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

  recalculateOrder(): void {
    this.orderItems.forEach(it => {
      const qty = Math.max(1, this.safeNumber(it.quantity, 1));
      const rate = Math.max(0, this.safeMoney(it.price));
      const taxPct = this.getTaxPct(it);
      const lineSubtotal = qty * rate; // SIN IVA
      const unitIva = this.round2(rate * taxPct);
      it.quantity = qty;
      it.price = rate;
      it.total = this.round2(lineSubtotal);
      it.iva = this.round2(unitIva * qty);
    });
  }

  // =================== Totales ===================
  get orderSubtotal(): number {
    return this.round2(this.orderItems.reduce((acc, it) => acc + (it.total ?? 0), 0));
  }

  get orderIva(): number {
    return this.round2(this.orderItems.reduce((acc, it) => {
      const storedIva = Number(it.iva);
      if (Number.isFinite(storedIva)) return acc + storedIva;

      const pct = this.getTaxPct(it);
      const unitIva = this.round2(this.safeMoney(it.price) * pct);
      return acc + this.round2(unitIva * this.safeNumber(it.quantity, 1));
    }, 0));
  }

  get orderTotal(): number {
    return this.round2(this.orderSubtotal + this.orderIva);
  }

  get pendingOrderToSplit(): number {
    const splitTotal = this.round2(
      (this.orderSplits || []).reduce((acc, row) => acc + this.safeNumber(row?.total, 0), 0)
    );
    return Math.max(0, this.round2(this.orderTotal - splitTotal));
  }

  get canOpenSplit(): boolean {
    return !this.isLocked && this.pendingOrderToSplit > 0;
  }

  get canShowCreateInvoice(): boolean {
    return this.order?.type === 'Nota Venta' && !this.isMesero;
  }

  get canCreateInvoice(): boolean {
    return this.canShowCreateInvoice && !this.isLocked;
  }

  get createInvoiceBlockedReason(): string {
    if (!this.canShowCreateInvoice) return '';
    if (this.isLocked) return 'La orden ya tiene facturacion asociada.';
    return '';
  }

  get splitItemsSource(): any[] {
    // Si ya hay subcuentas, usar solo remanente para evitar reusar items ya asignados.
    if ((this.orderSplits || []).length > 0) {
      return Array.isArray(this.splitRemainingItems) ? this.splitRemainingItems : [];
    }
    // Primera división: usar remanente si ya está, o items de la orden como fallback inicial.
    if (Array.isArray(this.splitRemainingItems) && this.splitRemainingItems.length) {
      return this.splitRemainingItems;
    }
    return Array.isArray(this.order?.items) ? this.order.items : [];
  }

  // =================== Guardado ===================
  saveOrderChanges(): void {
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
      product:   it.productId || 'ADHOC',         //  fieldname del child
      qty,                                        // 
      rate:      this.round2(rate),               // 
      tax:       it.tax ?? null,                  //  Link a "taxes" (ej. 'IVA-15'), opcional
      total:     lineSubtotal,                    //  subtotal SIN IVA
      tax_rate:  taxRate                          //  0 o 15
    };
  });

  const payload = {
    name: this.order.name,              // requerido por tu endpoint
    items,
    subtotal: this.orderSubtotal,       // totales de cabecera
    iva:      this.orderIva,
    total:    this.orderTotal
    // alias/email/estado/payments si también los actualizas desde la UI
  };

  this.ordersSvc.update(payload).subscribe({
    next: () => {
      toast.success('Orden actualizada.');
      this.loadProducts();
      if (this.order?.name) {
        this.fetch(this.order.name);
      }
    },
    error: () => toast.error('Error al actualizar la orden.')
  });

  console.log('payload actualizar orden =>', payload);
}



  // =================== Helpers ===================
  trackByIndex = (i: number) => i;

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
    if (this.isLocked) {
      toast.info('No se puede dividir una orden facturada.');
      return;
    }
    if (this.pendingOrderToSplit <= 0) {
      toast.info('La cuenta ya está totalmente dividida/pagada.');
      return;
    }
    this.showSplitDialog = true;
  }

  closeSplitDialog(): void {
    if (this.splitSubmitting) return;
    this.showSplitDialog = false;
  }

  createSplit(payload: SplitOrderPayload): void {
    if (this.splitSubmitting) return;

    this.splitSubmitting = true;
    this.orderSplitSvc.splitOrder(payload)
      .pipe(finalize(() => { this.splitSubmitting = false; }))
      .subscribe({
        next: () => {
          toast.success('Subcuenta creada correctamente.');
          this.showSplitDialog = false;
          this.loadOrderSplits();
        },
        error: (e) => {
          toast.error(this.extractBackendError(e));
        }
      });
  }

  invoiceSplit(row: OrderSplitRow): void {
    if (!row?.name || this.splitActionLoadingName || this.splitDeleteLoadingName) return;

    this.splitActionLoadingName = row.name;
    this.orderSplitSvc.createAndEmitFromSplit(row.name)
      .pipe(finalize(() => { this.splitActionLoadingName = ''; }))
      .subscribe({
        next: () => {
          toast.success('Subcuenta facturada correctamente.');
          this.loadOrderSplits();
          if (this.order?.name) {
            this.fetch(this.order.name);
          }
        },
        error: (e) => {
          toast.error(this.extractBackendError(e));
        }
      });
  }

  deleteSplit(row: OrderSplitRow): void {
    if (!row?.name || this.splitActionLoadingName || this.splitDeleteLoadingName) return;

    const splitLabel = row?.split_label || row?.alias || row?.name;
    const ok = window.confirm(`¿Eliminar la subcuenta "${splitLabel}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    this.splitDeleteLoadingName = row.name;
    this.orderSplitSvc.deleteOrderSplit(row.name)
      .pipe(finalize(() => { this.splitDeleteLoadingName = ''; }))
      .subscribe({
        next: () => {
          toast.success('Subcuenta eliminada correctamente.');
          this.loadOrderSplits();
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
      return;
    }

    this.splitsLoading = true;
    this.orderSplitSvc.getOrderSplits(this.order.name)
      .pipe(finalize(() => { this.splitsLoading = false; }))
      .subscribe({
        next: (res) => {
          const mapped = this.mapSplitsResponse(res);
          this.orderSplits = mapped.splits;
          this.splitRemainingItems = mapped.remaining;
        },
        error: (e) => {
          this.orderSplits = [];
          this.splitRemainingItems = [];
          toast.error(this.extractBackendError(e));
        }
      });
  }

  private loadPaymentMethods(): void {
    this.paymentsSvc.getAll().subscribe({
      next: (res: any[]) => {
        this.paymentMethods = Array.isArray(res) ? res : [];
      },
      error: (e) => {
        this.paymentMethods = [];
        toast.error(this.extractBackendError(e));
      }
    });
  }

  private mapSplitsResponse(res: any): { splits: OrderSplitRow[]; remaining: any[] } {
    const payload = res?.message ?? res ?? {};

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

    const splits = (splitsRaw as any[]).map((row: any) => ({
      ...row,
      invoice: row?.sales_invoice || row?.invoice || row?.factura || null,
      sri: row?.sri ?? {
        status: row?.sri_status,
        invoice: row?.sales_invoice || row?.invoice || row?.factura
      }
    }));

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

  // ====== Modal Cliente (opc) ======
  closeCustomerModal(): void {
    this.showCustomerModal = false;
  }
  saveCustomerForOrder(): void {
    // Hook si decides permitir cambiar el cliente de la orden
    this.showCustomerModal = false;
    toast.info('Conecta aquí el servicio para actualizar el cliente de la orden.');
  }

  get isLocked(): boolean {
  // Elige la condición que prefieras:
  // A) bloquear si es de tipo Factura
  // return this.order?.type === 'Factura';
  // B) bloquear si ya fue AUTORIZADA en SRI (recomendado)
    const linkedInvoice = String(
      this.order?.sri?.invoice ||
      this.order?.sales_invoice ||
      this.order?.invoice ||
      this.order?.factura ||
      ''
    ).trim();

    const sriStatus = this.normalizeStatus(this.order?.sri?.status);
    const hasRealSriStatus = !!sriStatus && sriStatus !== this.normalizeStatus('Sin factura');

    return !!linkedInvoice || this.order?.type === 'Factura' || hasRealSriStatus;
}

  get isMesero(): boolean {
    return this.roleName === 'Mesero';
  }

  get isClosed(): boolean {
    const status = this.normalizeStatus(this.order?.status);
    return status.includes('cerr') || status.includes('lista') || status.includes('entreg');
  }

  get isReadOnlyView(): boolean {
    return this.isMesero && this.isClosed;
  }

  get canEditOrder(): boolean {
    if (this.isLocked) return false;
    if (this.isClosed) return false;
    if (this.isReadOnlyView) return false;
    return true;
  }

  get orderStatusLabel(): string {
    const normalized = this.normalizeStatus(this.order?.status);
    if (!normalized) return 'Sin estado';
    if (normalized.includes('ingres')) return 'Ingresada';
    if (normalized.includes('prepar')) return 'Preparación';
    if (normalized.includes('cerr') || normalized.includes('lista') || normalized.includes('entreg')) return 'Cerrada';
    return String(this.order?.status || 'Sin estado');
  }

  get orderStatusClass(): string {
    const status = this.orderStatusLabel;
    if (status === 'Ingresada') return 'border-red-200 bg-red-100 text-red-700';
    if (status === 'Preparación') return 'border-amber-200 bg-amber-100 text-amber-700';
    if (status === 'Cerrada') return 'border-emerald-200 bg-emerald-100 text-emerald-700';
    return 'border-slate-200 bg-slate-100 text-slate-700';
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
}
