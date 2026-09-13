import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { concatMap, from, Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';

import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { RestaurantRealtimeService } from 'src/app/services/restaurant-realtime.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { PrintService } from 'src/app/services/print.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CompanyService } from 'src/app/services/company.service';

import { OrderCardComponent } from './ui/order-card/order-card.component';
import { OrderKitchenCardComponent } from './ui/order-kitchen-card/order-kitchen-card.component';
import { OrderModalComponent } from './ui/order-modal/order-modal.component';
import { OrderTableComponent } from './ui/order-table/order-table.component';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

type ViewMode = 'normal' | 'cocina';
type StatusFilter = 'ALL' | 'ACTIVAS' | 'Ingresada' | 'Preparación' | 'Cerrada';
type RoleName = 'Gerente' | 'Cajero' | 'Mesero' | 'Cocina' | 'Desconocido';

@Component({
  selector: 'app-orders-realtime',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OrderCardComponent,
    OrderKitchenCardComponent,
    OrderModalComponent,
    OrderTableComponent
  ],
  templateUrl: './orders-realtime.component.html'
})
export class OrdersRealtimeComponent implements OnInit, OnDestroy {

  orders: OrderVM[] = [];
  selectedOrder: OrderVM | null = null;
  viewMode: ViewMode = 'normal';
  roleName: RoleName = 'Desconocido';

  statusFilter: StatusFilter = 'ALL';
  search = '';
  newCount = 0;
  showPrintModal = false;
  pendingPrintOrderId: string | null = null;
  kitchenOnlyUrgent = false;
  kitchenFilter: 'ALL' | 'NEW' | 'PREP' | 'READY' = 'ALL';
  kitchenLoading = false;
  kitchenError = '';
  kitchenAccessChecked = false;
  kitchenAccessGranted = false;
  kitchenAccessError = '';
  realtimeConnected = false;

  total$ = this.rt.streamTotal();
  private sub = new Subscription();
  private pendingActions = new Set<string>();
  private pendingItemActions = new Set<string>();
  private kitchenPollTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private currentBusinessId = '';
  private readonly baseUrl = environment.URL;

  constructor(
    private rt: RealtimeOrdersService,
    private ordersApi: OrdersService,
    private utils: UtilsService,
    private router: Router,
    private printService: PrintService,
    private restaurantRealtime: RestaurantRealtimeService,
    private capabilities: CompanyCapabilitiesService,
    private companyService: CompanyService
  ) {}

  ngOnInit(): void {
    this.loadKitchenContext();
  }

  private loadKitchenContext(): void {
    const business = String(this.capabilities.activeBusinessId || localStorage.getItem('active_business') || '').trim();
    this.currentBusinessId = business;
    if (!business) {
      this.kitchenAccessChecked = true;
      this.kitchenAccessError = 'Debe seleccionar un negocio para consultar Cocina.';
      this.initializeStreams();
      return;
    }

    this.companyService.getLiteContext(business).subscribe({
      next: (context: any) => {
        this.roleName = this.detectRole();
        this.viewMode = this.roleName === 'Cocina' ? 'cocina' : 'normal';
        this.statusFilter = this.viewMode === 'cocina' ? 'ACTIVAS' : 'ALL';
        this.kitchenAccessGranted = this.canAccessKitchen(context);
        this.kitchenAccessError = this.kitchenAccessGranted
          ? ''
          : 'No tiene permisos para consultar o actualizar la cola de Cocina en este negocio.';
        this.kitchenAccessChecked = true;
        if (this.initialized) this.loadCurrentData();
        else this.initializeStreams();
      },
      error: (error: any) => {
        this.kitchenAccessChecked = true;
        this.kitchenAccessGranted = false;
        this.kitchenAccessError = this.readErrorMessage(error) || 'No se pudo validar el acceso a Cocina.';
        if (this.initialized) this.loadCurrentData();
        else this.initializeStreams();
      }
    });
  }

  private initializeStreams(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.sub.add(this.restaurantRealtime.activeBusiness$.subscribe((business) => {
      const nextBusiness = String(business || '').trim();
      if (!nextBusiness) {
        this.orders = [];
        this.selectedOrder = null;
        this.stopKitchenFallbackPolling();
        return;
      }
      if (nextBusiness === this.currentBusinessId) return;
      // El canal ya cambió: no conservar la cola de la empresa anterior.
      this.currentBusinessId = nextBusiness;
      this.orders = [];
      this.selectedOrder = null;
      this.kitchenAccessChecked = false;
      this.kitchenAccessGranted = false;
      this.stopKitchenFallbackPolling();
      this.loadKitchenContext();
    }));

    this.restaurantRealtime.activate(this.currentBusinessId);
    this.sub.add(this.restaurantRealtime.reconnected$.subscribe(() => {
      if (this.viewMode === 'cocina' && this.kitchenAccessGranted) this.loadKitchenOrders();
      else {
        const today = this.utils.getSoloFechaEcuador();
        this.rt.loadInitial(80, 0, today, today, undefined, true);
      }
    }));

    this.sub.add(this.restaurantRealtime.connected$.subscribe((connected) => {
      this.realtimeConnected = connected;
      if (connected) this.stopKitchenFallbackPolling();
      else if (this.viewMode === 'cocina' && this.kitchenAccessGranted) this.startKitchenFallbackPolling();
    }));

    this.loadCurrentData();

    this.sub.add(
      this.rt.streamOrders().subscribe(list => {
        const rows = list ?? [];
        this.orders = this.viewMode === 'cocina' && this.kitchenAccessGranted
          ? this.filterKitchenQueue(rows)
          : rows;
      })
    );

    this.sub.add(
      this.rt.streamNewCount().subscribe(n => this.newCount = n)
    );

    if (this.viewMode === 'cocina' && this.kitchenAccessGranted && !this.realtimeConnected) {
      this.startKitchenFallbackPolling();
    }
  }

  private loadCurrentData(): void {
    const today = this.utils.getSoloFechaEcuador();
    if (this.viewMode === 'cocina' && this.kitchenAccessGranted) this.loadKitchenOrders();
    else this.rt.loadInitial(80, 0, today, today, undefined, true);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopKitchenFallbackPolling();
  }

  toggleModoCocina() {
    this.setViewMode(this.viewMode === 'normal' ? 'cocina' : 'normal');
  }

  setViewMode(mode: ViewMode) {
    if (mode === 'cocina' && !this.kitchenAccessGranted) {
      toast.error(this.kitchenAccessError || 'Cocina no está habilitada para este negocio.');
      return;
    }
    this.viewMode = mode;
    this.statusFilter = mode === 'cocina' ? 'ACTIVAS' : 'ALL';
    this.kitchenOnlyUrgent = false;
    this.kitchenFilter = 'ALL';
    if (mode === 'cocina') {
      this.loadKitchenOrders();
      if (!this.realtimeConnected) this.startKitchenFallbackPolling();
    }
    else {
      this.stopKitchenFallbackPolling();
      const today = this.utils.getSoloFechaEcuador();
      this.rt.loadInitial(80, 0, today, today, undefined, true);
    }
    this.rt.markNewSeen();
  }

  open(o: OrderVM) {
    this.selectedOrder = o;
    this.rt.markNewSeen();
  }

  closeModal() {
    this.selectedOrder = null;
  }

  openPrintModal(order?: OrderVM | null) {
    if (this.viewMode !== 'normal') return;

    const id = order?.name || this.selectedOrder?.name || null;
    if (!id) {
      toast.error('No se pudo identificar la orden para imprimir.');
      return;
    }

    this.pendingPrintOrderId = id;
    this.showPrintModal = true;
  }

  closePrintModal() {
    this.showPrintModal = false;
    this.pendingPrintOrderId = null;
  }

  refreshRealtime() {
    const today = this.utils.getSoloFechaEcuador();
    if (this.viewMode === 'cocina') this.loadKitchenOrders();
    else this.rt.loadInitial(80, 0, today, today, undefined, true);
    this.rt.markNewSeen();
    toast.success('Ordenes actualizadas.');
  }

  handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas') {
    if (!this.pendingPrintOrderId) return;

    if (option === 'comanda') this.openPrintWindow(this.printService.getComanda(this.pendingPrintOrderId));
    if (option === 'recibo') this.openPrintWindow(this.printService.getRecibo(this.pendingPrintOrderId));
    if (option === 'ambas') this.openPrintWindow(this.printService.getOrderPdf(this.pendingPrintOrderId));

    this.closePrintModal();
  }

  toPreparacion(o: OrderVM) {
    if (!this.allowStatusActions || this.pendingActions.has(o.name)) return;
    if (this.viewMode === 'cocina') {
      if (this.kitchenBucket(o) !== 'NEW') return;
      this.updateKitchenItems(o, 'En preparacion');
      return;
    }
    if (o.status !== 'Ingresada') return;


    const prev = o.status;
    o.status = 'Preparación';
    this.pendingActions.add(o.name);

    this.ordersApi.updateStatus(o.name, 'Preparación').subscribe({
      error: () => {
        o.status = prev;
        toast.error('No se pudo actualizar la orden a Preparación.');
      }
    }).add(() => this.pendingActions.delete(o.name));
  }

  toCerrada(o: OrderVM) {
    if (!this.allowStatusActions || this.pendingActions.has(o.name)) return;
    if (this.viewMode === 'cocina') {
      if (this.kitchenBucket(o) !== 'PREP') return;
      this.updateKitchenItems(o, 'Listo');
      return;
    }
    if (o.status !== 'Preparación') return;

    const prev = o.status;
    this.pendingActions.add(o.name);

    o.status = 'Cerrada';
    (o as any)._flash = true;
    (o as any)._flashType = 'update';

    this.ordersApi.updateStatus(o.name, 'Cerrada').subscribe({
      next: () => {
        toast.success('Orden cerrada. Puedes abrirla para facturar cuando desees.');
      },
      error: () => {
        o.status = prev as any;
        delete (o as any)._flash;
        delete (o as any)._flashType;
        toast.error('No se pudo cerrar la orden.');
      }
    }).add(() => this.pendingActions.delete(o.name));
  }

  toEntregado(o: OrderVM): void {
    if (!this.allowStatusActions || this.pendingActions.has(o.name)) return;
    if (this.viewMode !== 'cocina' || this.kitchenBucket(o) !== 'READY') return;
    this.updateKitchenItems(o, 'Entregado');
  }

  goToOrder(order?: OrderVM | null) {
    const id = order?.name || this.selectedOrder?.name || null;
    if (!id) {
      toast.error('No se pudo identificar la orden.');
      return;
    }

    this.closeModal();
    this.router.navigate(['/dashboard/orders', id]);
  }

  trackByName = (_: number, o: OrderVM) => o.name;

  get allowStatusActions(): boolean {
    return this.roleName !== 'Mesero';
  }

  isActionPending(orderName: string): boolean {
    return this.pendingActions.has(orderName);
  }

  get pendingItemNames(): string[] {
    return Array.from(this.pendingItemActions);
  }

  get isCocinaOnly(): boolean {
    return this.roleName === 'Cocina';
  }

  get canSwitchView(): boolean {
    return !this.isCocinaOnly && this.kitchenAccessGranted;
  }

  get headerSubtitle(): string {
    if (this.isCocinaOnly) {
      return this.kitchenOnlyUrgent
        ? 'KDS activo · mostrando solo pedidos con demora.'
        : 'Pedidos organizados por prioridad para una operación rápida.';
    }
    return `Perfil actual: ${this.roleName} · Vista ${this.modeLabel}.`;
  }

  get modeLabel(): string {
    return this.viewMode === 'cocina' ? 'Cocina' : 'Caja';
  }

  get statusFilters(): { label: string; value: StatusFilter }[] {
    const base = [
      { label: 'Todas', value: 'ALL' as const },
      { label: 'Ingresadas', value: 'Ingresada' as const },
      { label: 'Preparación', value: 'Preparación' as const },
      { label: 'Cerradas', value: 'Cerrada' as const }
    ];

    if (this.viewMode === 'cocina') {
      return [{ label: 'Activas', value: 'ACTIVAS' as const }, ...base];
    }

    return base;
  }

  get filteredOrders(): OrderVM[] {
    const term = this.normalize(this.search);

    return this.orders.filter(o => {
      const status = this.normalizeStatus(o.status);
      const matchesStatus = this.matchStatus(status, this.statusFilter);
      if (!matchesStatus) return false;
      if (!term) return true;

      const customer = this.normalize(o.customer?.nombre);
      const customerId = this.normalize(o.customer?.num_identificacion);
      const alias = this.normalize(o.alias);
      const sriNumber = this.normalize(o.sri?.number);
      const sriStatus = this.normalize(o.sri?.status);
      const usuario = this.normalize(o.usuario);
      const name = this.normalize(o.name);

      return (
        name.includes(term) ||
        alias.includes(term) ||
        customer.includes(term) ||
        customerId.includes(term) ||
        sriNumber.includes(term) ||
        sriStatus.includes(term) ||
        usuario.includes(term)
      );
    });
  }

  get kitchenBaseOrders(): OrderVM[] {
    const term = this.normalize(this.search);

    return this.orders.filter((o) => {
      if (!term) return true;

      const customer = this.normalize(o.customer?.nombre);
      const customerId = this.normalize(o.customer?.num_identificacion);
      const alias = this.normalize(o.alias);
      const usuario = this.normalize(o.usuario);
      const name = this.normalize(o.name);

      return (
        name.includes(term) ||
        alias.includes(term) ||
        customer.includes(term) ||
        customerId.includes(term) ||
        usuario.includes(term)
      );
    });
  }

  get totalSales(): number {
    return this.orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  }

  get countIngresadas(): number {
    return this.orders.filter(o => this.isIngresadaStatus(o.status)).length;
  }

  get countPreparacion(): number {
    return this.orders.filter(o => this.normalizeStatus(o.status) === 'Preparación').length;
  }

  get countCerradas(): number {
    return this.orders.filter(o => this.normalizeStatus(o.status) === 'Cerrada').length;
  }

  get kitchenIngresadas(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.kitchenBucket(o) === 'NEW');
    return this.sortKitchenOrders(this.applyKitchenFilter(this.applyKitchenUrgentFilter(list), 'NEW'));
  }

  get kitchenPreparacion(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.kitchenBucket(o) === 'PREP');
    return this.sortKitchenOrders(this.applyKitchenFilter(this.applyKitchenUrgentFilter(list), 'PREP'));
  }

  get kitchenCerradas(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.kitchenBucket(o) === 'READY');
    return this.sortKitchenOrders(this.applyKitchenFilter(list, 'READY'));
  }

  get kitchenPreparacionVisible(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.normalizeStatus(o.status) === 'Preparación');
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenActivasCount(): number {
    return this.kitchenNewCount + this.kitchenPrepCount;
  }

  get kitchenNewCount(): number {
    return this.kitchenBaseOrders.filter((o) => this.kitchenBucket(o) === 'NEW').length;
  }

  get kitchenPrepCount(): number {
    return this.kitchenBaseOrders.filter((o) => this.kitchenBucket(o) === 'PREP').length;
  }

  get kitchenPreparacionSafe(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter((o) => this.kitchenBucket(o) === 'PREP');
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenUrgentesCount(): number {
    const active = this.kitchenBaseOrders.filter((o) => {
      const status = this.kitchenBucket(o);
      return status === 'NEW' || status === 'PREP';
    });
    return active.filter((o) => this.isUrgentOrder(o)).length;
  }

  get kitchenAverageMinutes(): number {
    const active = this.kitchenBaseOrders.filter((o) => {
      const status = this.kitchenBucket(o);
      return status === 'NEW' || status === 'PREP';
    });
    if (!active.length) return 0;
    return Math.round(active.reduce((total, order) => total + this.getOrderAgeMinutes(order), 0) / active.length);
  }

  get kitchenReadyCount(): number {
    return this.kitchenBaseOrders.filter((o) => this.kitchenBucket(o) === 'READY').length;
  }

  /** Determina la columna KDS a partir del estado de los ítems de cocina. */
  kitchenBucket(order: OrderVM): 'NEW' | 'PREP' | 'READY' {
    const items: any[] = Array.isArray(order?.items) ? order.items : [];
    const kitchenStatuses = items
      .map((item: any) => this.normalize(item?.kitchen_status ?? item?.kitchenStatus ?? item?.estado_cocina))
      .filter(Boolean);

    if (kitchenStatuses.some(status => status.includes('prepar'))) return 'PREP';
    if (kitchenStatuses.length > 0 && kitchenStatuses.every(status =>
      status.includes('list') || status.includes('entreg') || status.includes('cancel')
    )) return 'READY';
    if (kitchenStatuses.some(status => status.includes('pend'))) return 'NEW';

    const orderStatus = this.normalizeStatus(order?.status);
    if (orderStatus === 'Preparación') return 'PREP';
    if (orderStatus === 'Lista' || orderStatus === 'Cerrada') return 'READY';
    return 'NEW';
  }

  setKitchenFilter(filter: 'ALL' | 'NEW' | 'PREP' | 'READY'): void {
    this.kitchenFilter = filter;
  }

  get kitchenFilterLabel(): string {
    if (this.kitchenFilter === 'NEW') return 'Nuevos';
    if (this.kitchenFilter === 'PREP') return 'En preparación';
    if (this.kitchenFilter === 'READY') return 'Listos';
    return 'Todos';
  }

  get kitchenOnlyUrgentLabel(): string {
    return this.kitchenOnlyUrgent ? 'Ver todas' : 'Solo urgentes';
  }

  toggleKitchenUrgent() {
    this.kitchenOnlyUrgent = !this.kitchenOnlyUrgent;
  }

  private matchStatus(status: string, filter: StatusFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVAS') return status === 'Ingresada' || status === 'Preparación';
    if (filter === 'Cerrada') return status === 'Cerrada' || status === 'Lista';
    return status === filter;
  }

  private canAccessKitchen(context: any): boolean {
    const features = context?.features ?? this.capabilities.features;
    if (features?.kitchen !== true) return false;
    const permissions = context?.permissions ?? this.capabilities.permissions;
    const hasPermission = (required: string): boolean => {
      if (Array.isArray(permissions)) {
        const values = permissions.map((item: any) => this.normalize(item));
        return values.includes('*')
          || values.includes(required)
          || values.includes(required.replace('restaurant.orders.', 'orders.'))
          || values.includes('restaurant.orders.manage')
          || values.includes('restaurant.manage')
          || values.includes('orders.manage');
      }
      if (!permissions || typeof permissions !== 'object') return false;
      if (permissions['*'] === true || permissions['*'] === 1 || String(permissions['*']).toLowerCase() === 'true') return true;
      const direct = permissions[required] ?? permissions[required.replace('restaurant.orders.', 'orders.')];
      if (direct !== undefined) return direct === true || direct === 1 || direct === '1';
      const grouped = permissions.restaurant?.orders ?? permissions.orders;
      const action = required.endsWith('.read') ? 'read' : 'update';
      return permissions.restaurant?.manage === true
        || permissions.restaurant?.orders?.manage === true
        || permissions.orders?.manage === true
        || grouped?.[action] === true
        || grouped?.[action] === 1
        || grouped?.[action] === '1'
        || grouped?.manage === true;
    };

    return hasPermission('restaurant.orders.read') && hasPermission('restaurant.orders.update');
  }

  private filterKitchenQueue(rows: OrderVM[]): OrderVM[] {
    const allowedStatuses = new Set(['Ingresada', 'Preparación', 'Lista']);
    return rows
      .filter((order) => allowedStatuses.has(this.normalizeStatus(order.status)))
      .map((order) => ({
        ...order,
        items: (order.items || []).filter((item: any) => {
          const status = this.normalize(item?.kitchen_status ?? item?.kitchenStatus ?? item?.estado_cocina);
          return !status.includes('entreg') && !status.includes('cancel');
        })
      }))
      .filter((order) => order.items.length > 0);
  }

  private startKitchenFallbackPolling(): void {
    if (this.kitchenPollTimer || !this.kitchenAccessGranted) return;
    this.kitchenPollTimer = setInterval(() => {
      if (!this.realtimeConnected && this.viewMode === 'cocina' && !this.kitchenLoading) {
        this.loadKitchenOrders();
      }
    }, 10000);
  }

  private stopKitchenFallbackPolling(): void {
    if (this.kitchenPollTimer) {
      clearInterval(this.kitchenPollTimer);
      this.kitchenPollTimer = null;
    }
  }

  private loadKitchenOrders(): void {
    if (!this.kitchenAccessGranted) return;
    this.kitchenLoading = true;
    this.kitchenError = '';
    this.ordersApi.getKitchenOrders(100).subscribe({
      next: (response: any) => {
        const body = response?.message ?? response ?? {};
        const rows = Array.isArray(body?.data) ? body.data : [];
        const normalized = rows.map((row: any) => this.rt.mapOne(row));
        this.rt.replaceOrders(this.filterKitchenQueue(normalized));
      },
      error: (error: any) => {
        this.kitchenError = this.readErrorMessage(error) || 'No se pudo cargar la cola de cocina.';
        toast.error(this.kitchenError);
      }
    }).add(() => { this.kitchenLoading = false; });
  }

  private updateKitchenItems(order: OrderVM, kitchenStatus: 'En preparacion' | 'Listo' | 'Entregado'): void {
    if (this.pendingActions.has(order.name)) return;
    const rows = (order.items || [])
      // El backend espera el nombre de la fila hija, no el código del producto.
      // Los distintos contratos han usado name, order_item, row_id o id.
      .map((item: any) => String(item?.name ?? item?.order_item ?? item?.row_id ?? item?.id ?? '').trim())
      .filter(Boolean);
    if (!rows.length) {
      toast.error('La orden no incluye identificadores de ítems para cocina.');
      return;
    }

    this.pendingActions.add(order.name);
    from(rows).pipe(
      // Las respuestas contienen la orden completa; se procesan en secuencia
      // para que la última respuesta incluya el estado de todos los ítems.
      concatMap((rowId) => this.ordersApi.updateKitchenItemStatus(order.name, rowId, kitchenStatus))
    ).subscribe({
        next: (response: any) => {
          const body = response?.message ?? response ?? {};
          const updated = body?.data ?? response?.data;
          if (updated?.name) this.rt.replaceOrder(updated);
          else this.loadKitchenOrders();
        },
        complete: () => {
          const message = kitchenStatus === 'Listo'
            ? 'Ítems marcados como listos.'
            : kitchenStatus === 'Entregado'
              ? 'Pedido marcado como entregado.'
              : 'Ítems enviados a preparación.';
          toast.success(message);
        },
        error: (error: any) => {
          const message = this.readErrorMessage(error);
          toast.error(message || 'No se pudo actualizar el estado de cocina.');
        }
      }).add(() => this.pendingActions.delete(order.name));
  }

  updateKitchenItem(event: {
    order: OrderVM;
    item: any;
    kitchenStatus: 'Pendiente' | 'En preparacion' | 'Listo' | 'Entregado' | 'Cancelado';
  }): void {
    const orderName = String(event?.order?.name || '').trim();
    const itemName = String(event?.item?.name ?? event?.item?.order_item ?? event?.item?.row_id ?? event?.item?.id ?? '').trim();
    if (!orderName || !itemName || this.pendingItemActions.has(`${orderName}:${itemName}`)) return;

    const key = `${orderName}:${itemName}`;
    this.pendingItemActions.add(key);
    this.ordersApi.updateKitchenItemStatus(orderName, itemName, event.kitchenStatus).subscribe({
      next: (response: any) => {
        const body = response?.message ?? response ?? {};
        const updated = body?.data ?? response?.data;
        if (updated?.name) this.rt.replaceOrder(updated);
        else this.loadKitchenOrders();
      },
      error: (error: any) => {
        toast.error(this.readErrorMessage(error) || 'No se pudo actualizar el ítem de cocina.');
      }
    }).add(() => this.pendingItemActions.delete(key));
  }

  private normalizeStatus(raw?: string): 'Ingresada' | 'Preparación' | 'Cerrada' | string {
    const value = this.normalize(raw);

    if (value.includes('ingres')) return 'Ingresada';
    if (value.includes('prepar')) return 'Preparación';
    if (value.includes('list')) return 'Lista';
    if (value.includes('cerr') || value.includes('entreg')) return 'Cerrada';

    return raw || 'Ingresada';
  }

  private normalize(value: any): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private sortKitchenOrders(list: OrderVM[]): OrderVM[] {
    return [...list].sort((a, b) => this.getOrderAgeMinutes(b) - this.getOrderAgeMinutes(a));
  }

  private applyKitchenUrgentFilter(list: OrderVM[]): OrderVM[] {
    if (!this.kitchenOnlyUrgent) return list;
    return list.filter((o) => this.isUrgentOrder(o));
  }

  private applyKitchenFilter(list: OrderVM[], bucket: 'NEW' | 'PREP' | 'READY'): OrderVM[] {
    return this.kitchenFilter === 'ALL' || this.kitchenFilter === bucket ? list : [];
  }

  private isUrgentOrder(order: OrderVM): boolean {
    return this.getOrderAgeMinutes(order) >= 20;
  }

  private getOrderAgeMinutes(order: OrderVM): number {
    const raw = order.createdAtISO || order.createdAt;
    if (!raw) return 0;
    const time = new Date(raw).getTime();
    if (!Number.isFinite(time)) return 0;
    return Math.max(0, Math.floor((Date.now() - time) / 60000));
  }

  private detectRole(): RoleName {
    const contextRole = this.normalize(this.capabilities.businessRole || '');
    if (contextRole.includes('cocina') || contextRole.includes('chef') || contextRole.includes('kitchen')) return 'Cocina';
    if (contextRole.includes('gerente') || contextRole.includes('admin')) return 'Gerente';
    if (contextRole.includes('cajero')) return 'Cajero';
    if (contextRole.includes('mesero')) return 'Mesero';

    const raw = localStorage.getItem('user');
    if (!raw) return 'Desconocido';

    try {
      const user = JSON.parse(raw);
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      const joined = roles.map((r: string) => this.normalize(r)).join(' ');

      if (joined.includes('cocina') || joined.includes('chef') || joined.includes('kitchen')) return 'Cocina';
      if (joined.includes('gerente') || joined.includes('admin')) return 'Gerente';
      if (joined.includes('cajero')) return 'Cajero';
      if (joined.includes('mesero')) return 'Mesero';
    } catch {
      return 'Desconocido';
    }

    return 'Desconocido';
  }

  private openPrintWindow(path: string): void {
    const url = this.baseUrl + path;
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

  private isIngresadaStatus(raw?: string): boolean {
    return this.normalize(raw).includes('ingres');
  }

  private isPreparacionStatus(raw?: string): boolean {
    return this.normalize(raw).includes('prepar');
  }

  private isCerradaStatus(raw?: string): boolean {
    const value = this.normalize(raw);
    return value.includes('cerr') || value.includes('lista') || value.includes('entreg');
  }

  private readErrorMessage(error: any): string {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    if (status === 403) return 'No tienes permiso para realizar esta operación.';
    const body = error?.error ?? error;
    const extract = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'string') return value.trim();
      if (Array.isArray(value)) return value.map(extract).filter(Boolean).join(' ');
      if (typeof value !== 'object') return '';
      const direct = extract(value.message) || extract(value.sri_message) || extract(value.emission_error);
      if (direct) return direct;
      if (value.messages) {
        const messages = extract(value.messages);
        if (messages) return messages;
      }
      if (typeof value._server_messages === 'string') {
        try {
          const parsed = JSON.parse(value._server_messages);
          const messages = extract(parsed);
          if (messages) return messages;
        } catch { /* Frappe puede devolver un texto no serializado. */ }
      }
      return '';
    };
    const message = extract(body);
    if (message) return message;
    const fallback = error?.message;
    if (typeof fallback === 'string') return fallback;
    if (typeof error?.statusText === 'string') return error.statusText;
    return '';
  }

}
