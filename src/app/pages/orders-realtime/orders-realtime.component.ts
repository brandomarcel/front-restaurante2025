import { WakeLockService } from '../../core/services/wake-lock.service';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';

import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { RestaurantRealtimeService } from 'src/app/services/restaurant-realtime.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { PrintService } from 'src/app/services/print.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

import { OrderCardComponent } from './ui/order-card/order-card.component';
import { OrderKitchenCardComponent } from './ui/order-kitchen-card/order-kitchen-card.component';
import { OrderModalComponent } from './ui/order-modal/order-modal.component';
import { OrderTableComponent } from './ui/order-table/order-table.component';
import { KitchenStage, kitchenStage } from './ui/order-status.utils';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

type ViewMode = 'normal' | 'cocina';
type StatusFilter = 'ALL' | 'ACTIVAS' | 'Ingresada' | 'Preparación' | 'Lista' | 'Cerrada';

/** Preferencia por dispositivo: la tablet de cocina recuerda si el aviso sonoro está activo. */
const KDS_SOUND_KEY = 'facturada.kds.sound';
/** Tamaño de lectura del KDS, también por dispositivo. */
const KDS_LARGE_KEY = 'facturada.kds.large';
const CLOCK_TICK_MS = 30_000;
/** Ventana para deshacer un cambio de etapa tocado por error. */
const KDS_UNDO_MS = 8_000;
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
    OrderTableComponent,
    FontAwesomeModule
  ],
  templateUrl: './orders-realtime.component.html',
  styleUrl: './orders-realtime.component.css'
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
  /** Cocina: pedidos en curso (tres columnas) o los entregados hoy. */
  kitchenTab: 'ACTIVE' | 'DONE' = 'ACTIVE';
  /** En celular se ve una columna a la vez; en escritorio, las tres. */
  mobileColumn: KitchenStage = 'NEW';
  /** Pedidos de hoy ya entregados; solo lectura, sin precios. Se consulta al abrir la pestaña. */
  deliveredOrders: OrderVM[] = [];
  deliveredLoading = false;
  deliveredError = '';
  kitchenLoading = false;
  kitchenError = '';
  kitchenAccessChecked = false;
  kitchenAccessGranted = false;
  kitchenAccessError = '';
  realtimeConnected = false;
  /** Reloj compartido para los tiempos de espera de Caja (un solo timer para toda la lista). */
  now = Date.now();
  soundEnabled = this.readSoundPreference();
  isFullscreen = false;
  /** El navegador solo permite audio tras un gesto del usuario; hasta entonces el aviso sonoro no suena. */
  audioUnlocked = false;
  largeMode = this.readLargePreference();

  total$ = this.rt.streamTotal();
  private sub = new Subscription();
  private pendingActions = new Set<string>();
  private pendingItemActions = new Set<string>();
  private kitchenPollTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private audioContext: AudioContext | null = null;
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
    private host: ElementRef<HTMLElement>,
    private wakeLock: WakeLockService
  ) {}

  ngOnInit(): void {
    this.clockTimer = setInterval(() => this.now = Date.now(), CLOCK_TICK_MS);
    this.loadKitchenContext();
  }

  /**
   * Rol y acceso a Cocina salen del contexto que la app ya cargó (el cambio de
   * negocio recarga la página). Antes se pedía otro contexto al backend y, si
   * esa llamada fallaba, el usuario de Cocina caía en la vista de Caja con
   * totales y ventas del día.
   */
  private loadKitchenContext(): void {
    const business = String(this.capabilities.activeBusinessId || localStorage.getItem('active_business') || '').trim();
    this.currentBusinessId = business;
    this.roleName = this.detectRole();
    this.viewMode = this.roleName === 'Cocina' ? 'cocina' : 'normal';
    this.statusFilter = this.viewMode === 'cocina' ? 'ACTIVAS' : 'ALL';
    this.kitchenAccessChecked = true;

    if (!business) {
      this.kitchenAccessGranted = false;
      this.kitchenAccessError = 'Debe seleccionar un negocio para consultar Cocina.';
    } else if (!this.capabilities.isLoaded) {
      this.kitchenAccessGranted = false;
      this.kitchenAccessError = 'No se pudo validar el acceso a Cocina. Recarga la página.';
    } else {
      this.kitchenAccessGranted = this.canAccessKitchen();
      this.kitchenAccessError = this.kitchenAccessGranted
        ? ''
        : 'No tiene permisos para consultar o actualizar la cola de Cocina en este negocio.';
    }

    if (!business) {
      this.initializeStreams();
      return;
    }
    if (this.initialized) {
      this.loadCurrentData();
      if (!this.realtimeConnected) this.startFallbackPolling();
    } else this.initializeStreams();
    this.syncWakeLock();
  }

  /** En modo Cocina la pantalla no debe apagarse sola; en Caja se respeta el ajuste del equipo. */
  private syncWakeLock(): void {
    if (this.viewMode === 'cocina' && this.kitchenAccessGranted) void this.wakeLock.acquire();
    else void this.wakeLock.release();
  }

  private initializeStreams(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.sub.add(this.restaurantRealtime.activeBusiness$.subscribe((business) => {
      const nextBusiness = String(business || '').trim();
      if (!nextBusiness) {
        this.orders = [];
        this.selectedOrder = null;
        this.stopFallbackPolling();
        return;
      }
      if (nextBusiness === this.currentBusinessId) return;
      // El canal ya cambió: no conservar la cola de la empresa anterior.
      this.currentBusinessId = nextBusiness;
      this.orders = [];
      this.selectedOrder = null;
      this.kitchenAccessChecked = false;
      this.kitchenAccessGranted = false;
      this.stopFallbackPolling();
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

    // Agregaron o anularon productos de una orden en curso: Cocina lo oye y lo ve en un aviso.
    this.sub.add(this.restaurantRealtime.events$.subscribe((event) => {
      if (this.viewMode === 'cocina' && event.event_type === 'order.updated' && event.action === 'items_added') {
        this.playNewOrderSound();
        toast.info(`Agregaron productos a la orden #${event.data?.name ?? ''}`);
      }
      // Gerente/Administrador anuló un producto: que cocina no lo prepare (desaparece de la tarjeta).
      if (this.viewMode === 'cocina' && event.event_type === 'order.updated' && event.action === 'item_voided') {
        const voided = event.data?.voided_item;
        this.playNewOrderSound();
        toast.warning(`Anulado en la orden #${event.data?.name ?? ''}: ${voided?.qty ?? ''} × ${voided?.item_name ?? 'producto'}. No lo prepares.`, { duration: 10000 });
      }
    }));

    this.sub.add(this.restaurantRealtime.connected$.subscribe((connected) => {
      this.realtimeConnected = connected;
      if (connected) this.stopFallbackPolling();
      else this.startFallbackPolling();
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
      this.rt.streamNewCount().subscribe(n => {
        if (n > this.newCount && this.viewMode === 'cocina') this.playNewOrderSound();
        this.newCount = n;
      })
    );

    if (!this.realtimeConnected) this.startFallbackPolling();
  }

  private loadCurrentData(): void {
    const today = this.utils.getSoloFechaEcuador();
    if (this.viewMode === 'cocina' && this.kitchenAccessGranted) this.loadKitchenOrders();
    else this.rt.loadInitial(80, 0, today, today, undefined, true);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopFallbackPolling();
    void this.wakeLock.release();
    if (this.clockTimer) clearInterval(this.clockTimer);
    void this.audioContext?.close().catch(() => undefined);
  }

  // ---- Aviso sonoro y pantalla completa (Cocina) ----

  /** Un toque en cualquier parte habilita el audio, para no depender de que alguien pulse «Sonido». */
  @HostListener('document:pointerdown')
  @HostListener('document:keydown')
  unlockAudio(): void {
    if (this.audioUnlocked || typeof window === 'undefined') return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.audioContext ??= new Ctx();
      void this.audioContext.resume().then(() => { this.audioUnlocked = this.audioContext?.state === 'running'; });
    } catch { /* sin audio: queda el aviso visual */ }
  }

  get showSoundHint(): boolean {
    return this.viewMode === 'cocina' && this.soundEnabled && !this.audioUnlocked;
  }

  toggleLarge(): void {
    this.largeMode = !this.largeMode;
    try { localStorage.setItem(KDS_LARGE_KEY, this.largeMode ? '1' : '0'); } catch { /* solo esta sesión */ }
  }

  private readLargePreference(): boolean {
    try { return localStorage.getItem(KDS_LARGE_KEY) === '1'; } catch { return false; }
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    try { localStorage.setItem(KDS_SOUND_KEY, this.soundEnabled ? '1' : '0'); } catch { /* sin almacenamiento: solo esta sesión */ }
    // El clic del usuario habilita el audio en el navegador; se confirma con un aviso de prueba.
    if (this.soundEnabled) {
      this.unlockAudio();
      this.playNewOrderSound();
    }
  }

  /** Dos tonos cortos generados con Web Audio (sin archivos). Si el navegador bloquea el audio, no hace nada. */
  private playNewOrderSound(): void {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.audioContext ??= new Ctx();
      const ctx = this.audioContext;
      void ctx.resume();
      [0, 0.18].forEach((offset, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = index ? 1175 : 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.17);
      });
    } catch { /* el aviso visual sigue funcionando */ }
  }

  private readSoundPreference(): boolean {
    try { return localStorage.getItem(KDS_SOUND_KEY) !== '0'; } catch { return true; }
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    // Solo esta pantalla (sin menú ni barra de la app), pensado para la tablet de cocina.
    else void this.host.nativeElement.requestFullscreen?.().catch(() => toast.error('El navegador no permitió la pantalla completa.'));
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = this.viewMode === 'cocina' ? 'ACTIVAS' : 'ALL';
    this.kitchenTab = 'ACTIVE';
    this.kitchenOnlyUrgent = false;
  }

  setViewMode(mode: ViewMode) {
    if (mode === 'cocina' && !this.kitchenAccessGranted) {
      toast.error(this.kitchenAccessError || 'Cocina no está habilitada para este negocio.');
      return;
    }
    this.viewMode = mode;
    this.statusFilter = mode === 'cocina' ? 'ACTIVAS' : 'ALL';
    this.kitchenOnlyUrgent = false;
    this.kitchenTab = 'ACTIVE';
    this.syncWakeLock();
    if (mode === 'cocina') {
      this.loadKitchenOrders();
      if (!this.realtimeConnected) this.startFallbackPolling();
    }
    else {
      const today = this.utils.getSoloFechaEcuador();
      this.rt.loadInitial(80, 0, today, today, undefined, true);
      if (!this.realtimeConnected) this.startFallbackPolling();
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
  }

  handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas') {
    if (!this.pendingPrintOrderId) return;

    if (option === 'comanda') this.openPrintWindow(this.printService.getComanda(this.pendingPrintOrderId));
    if (option === 'recibo') this.openPrintWindow(this.printService.getRecibo(this.pendingPrintOrderId));
    if (option === 'ambas') this.openPrintWindow(this.printService.getOrderPdf(this.pendingPrintOrderId));

    this.closePrintModal();
  }

  /** Sin cocina habilitada no se «envía a cocina»: Caja imprime y cobra. */
  get kitchenEnabled(): boolean {
    return this.capabilities.isEnabled('kitchen');
  }

  /** Imprime la comanda directo desde la tarjeta «Nuevas», sin pasar por el modal. */
  printComanda(o: OrderVM): void {
    if (!o?.name) return;
    if (!this.printService.openComanda(o.name)) toast.error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.');
  }

  /**
   * Avances de cocina, iguales en Caja y en Cocina: mueven los platos del pedido y el estado de la
   * orden los sigue en el backend. Antes Caja cambiaba solo la orden («Enviar a cocina», «Cerrar
   * orden»): cocina seguía viendo los platos pendientes, o perdía un pedido que aún no estaba hecho.
   */
  toPreparacion(o: OrderVM): void {
    this.advanceKitchen(o, 'NEW', 'En preparacion');
  }

  toLista(o: OrderVM): void {
    this.advanceKitchen(o, 'PREP', 'Listo');
  }

  toEntregado(o: OrderVM): void {
    this.advanceKitchen(o, 'READY', 'Entregado');
  }

  private advanceKitchen(o: OrderVM, from: KitchenStage, to: 'En preparacion' | 'Listo' | 'Entregado'): void {
    if (!this.allowStatusActions || !this.kitchenEnabled || this.pendingActions.has(o.name)) return;
    if (this.kitchenBucket(o) !== from) return;
    this.updateKitchenItems(o, to);
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
  trackByColumn = (_: number, column: { key?: string; value?: string }) => column.key ?? column.value;

  /** Columnas del KDS en orden de flujo: nuevos → preparando → listos. */
  get kitchenColumns(): { key: 'NEW' | 'PREP' | 'READY'; title: string; hint: string; orders: OrderVM[]; empty: string }[] {
    return [
      { key: 'NEW', title: 'Nuevos', hint: 'Por empezar', orders: this.kitchenIngresadas, empty: 'Sin pedidos por empezar.' },
      { key: 'PREP', title: 'Preparando', hint: 'En la cocina', orders: this.kitchenPreparacionSafe, empty: 'Nada en preparación.' },
      { key: 'READY', title: 'Listos', hint: 'Para entregar', orders: this.kitchenCerradas, empty: 'Nada esperando entrega.' },
    ];
  }

  /** Cambiar el estado exige permiso de actualizar órdenes (el Mesero y el rol Usuario no lo tienen). */
  get allowStatusActions(): boolean {
    return this.capabilities.hasPermission('restaurant.manage')
      || this.capabilities.hasPermission('restaurant.orders.update');
  }

  isActionPending(orderName: string): boolean {
    return this.pendingActions.has(orderName);
  }

  /** Pedidos con un avance de cocina en curso (para deshabilitar su botón en la tabla de Caja). */
  get pendingOrderNames(): string[] {
    return Array.from(this.pendingActions);
  }

  get pendingItemNames(): string[] {
    return Array.from(this.pendingItemActions);
  }

  get isCocinaOnly(): boolean {
    return this.roleName === 'Cocina';
  }

  get canSwitchView(): boolean {
    // Sin acciones de estado (Mesero) la vista de Cocina no aporta nada.
    return !this.isCocinaOnly && this.kitchenAccessGranted && this.allowStatusActions;
  }

  /** Pestañas de Caja con su contador; los nombres describen la etapa, no el valor técnico. */
  get statusTabs(): { label: string; value: StatusFilter; count: number }[] {
    return [
      { label: 'Todas', value: 'ALL', count: this.orders.length },
      { label: 'Nuevas', value: 'Ingresada', count: this.countIngresadas },
      { label: 'En cocina', value: 'Preparación', count: this.countPreparacion },
      { label: 'Listas', value: 'Lista', count: this.countListas },
      { label: 'Cerradas', value: 'Cerrada', count: this.countCerradas },
    ];
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
    return this.orders
      .filter(o => !this.normalize(o.status).includes('cancel'))
      .reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  }

  get countIngresadas(): number {
    return this.orders.filter(o => this.isIngresadaStatus(o.status)).length;
  }

  get countPreparacion(): number {
    return this.orders.filter(o => this.normalizeStatus(o.status) === 'Preparación').length;
  }

  get countListas(): number {
    return this.orders.filter(o => this.normalizeStatus(o.status) === 'Lista').length;
  }

  get countCerradas(): number {
    return this.orders.filter(o => this.normalizeStatus(o.status) === 'Cerrada').length;
  }

  get kitchenIngresadas(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.kitchenBucket(o) === 'NEW');
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenCerradas(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.kitchenBucket(o) === 'READY');
    return this.sortKitchenOrders(list);
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

  /** Columna de cocina según el estado de sus platos (misma regla que la tabla de Caja y el modal). */
  kitchenBucket(order: OrderVM): KitchenStage {
    return kitchenStage(order);
  }

  setKitchenTab(tab: 'ACTIVE' | 'DONE'): void {
    this.kitchenTab = tab;
    if (tab === 'DONE') this.loadDeliveredToday();
  }

  loadDeliveredToday(): void {
    if (!this.kitchenAccessGranted || this.deliveredLoading) return;
    this.deliveredLoading = true;
    this.deliveredError = '';
    this.ordersApi.getKitchenDeliveredOrders(100).subscribe({
      next: (response: any) => {
        const body = response?.message ?? response ?? {};
        const rows = body?.data ?? [];
        this.deliveredOrders = (Array.isArray(rows) ? rows : [])
          .map((row: any) => this.rt.mapOne(row))
          .filter((order: OrderVM) => this.isDeliveredOrder(order));
      },
      error: (error: any) => {
        this.deliveredError = this.readErrorMessage(error) || 'No se pudieron cargar las entregas de hoy.';
      }
    }).add(() => { this.deliveredLoading = false; });
  }

  /** Cerrada, o con todos sus ítems (menos los cancelados) entregados. Las canceladas no cuentan. */
  private isDeliveredOrder(order: OrderVM): boolean {
    const status = this.normalize(order.status);
    if (status.includes('cancel')) return false;
    if (status.includes('cerrad')) return true;
    const kitchen = ((order.items || []) as any[])
      .map((item) => this.normalize(item?.kitchen_status ?? item?.kitchenStatus ?? item?.estado_cocina))
      .filter((s) => !!s && !s.includes('cancel'));
    return kitchen.length > 0 && kitchen.every((s) => s.includes('entreg'));
  }

  toggleKitchenUrgent() {
    this.kitchenOnlyUrgent = !this.kitchenOnlyUrgent;
  }

  private matchStatus(status: string, filter: StatusFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVAS') return status === 'Ingresada' || status === 'Preparación';
    return status === filter;
  }

  /**
   * Visibilidad de `ui_capabilities` (con respaldo a la feature) más permiso
   * para ver y para actualizar órdenes; `restaurant.manage` cubre ambos.
   */
  private canAccessKitchen(): boolean {
    const manage = this.capabilities.hasPermission('restaurant.manage');
    return this.capabilities.restaurantKitchenVisible
      && (manage || this.capabilities.hasPermission('restaurant.orders.read'))
      && (manage || this.capabilities.hasPermission('restaurant.orders.update'));
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

  /** Sin socket, tanto Caja como Cocina consultan cada 10 s (el encabezado lo anuncia). */
  private startFallbackPolling(): void {
    if (this.kitchenPollTimer || !this.currentBusinessId) return;
    this.kitchenPollTimer = setInterval(() => {
      if (this.realtimeConnected) return;
      if (this.viewMode === 'cocina' && this.kitchenAccessGranted) {
        if (!this.kitchenLoading) this.loadKitchenOrders();
      } else if (this.viewMode === 'normal') {
        const today = this.utils.getSoloFechaEcuador();
        this.rt.loadInitial(80, 0, today, today, undefined, true);
      }
    }, 10000);
  }

  private stopFallbackPolling(): void {
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

  private updateKitchenItems(
    order: OrderVM,
    kitchenStatus: 'Pendiente' | 'En preparacion' | 'Listo' | 'Entregado',
    isUndo = false,
    restore?: Record<string, string>
  ): void {
    if (this.pendingActions.has(order.name)) return;

    // Estado de cada ítem antes del cambio, para que Deshacer no iguale ítems que estaban distintos.
    const previous: Record<string, string> = {};
    for (const item of (order.items || []) as any[]) {
      const status = String(item?.kitchen_status ?? item?.kitchenStatus ?? '').trim();
      if (item?.name && ['Pendiente', 'En preparacion', 'Listo'].includes(status)) previous[item.name] = status;
    }

    this.pendingActions.add(order.name);
    this.ordersApi.updateKitchenOrderStatus(order.name, kitchenStatus, restore).subscribe({
        next: (response: any) => {
          const body = response?.message ?? response ?? {};
          const updated = body?.data ?? response?.data;
          if (updated?.name) this.rt.replaceOrder(updated);
          else this.loadKitchenOrders();
        },
        complete: () => {
          if (isUndo) {
            toast.success('Cambio deshecho.');
            return;
          }
          // Entregado no se ofrece deshacer: el backend puede cerrar la orden y liberar la mesa.
          const undoTo = kitchenStatus === 'Listo' ? 'En preparacion' : kitchenStatus === 'En preparacion' ? 'Pendiente' : null;
          const who = this.orderLabel(order);
          const message = kitchenStatus === 'Listo'
            ? `${who}: lista para entregar.`
            : kitchenStatus === 'Entregado'
              ? `${who}: entregada.`
              : `${who}: en preparación.`;
          if (!undoTo) {
            toast.success(message);
            return;
          }
          toast.success(message, {
            duration: KDS_UNDO_MS,
            action: { label: 'Deshacer', onClick: () => this.updateKitchenItems(order, undoTo, true, previous) }
          });
        },
        error: (error: any) => {
          const message = this.readErrorMessage(error);
          toast.error(message || 'No se pudo actualizar el estado de cocina.');
        }
      }).add(() => this.pendingActions.delete(order.name));
  }

  /** Cómo se nombra el pedido en los avisos: mesa o alias, si no el número. */
  private orderLabel(order: OrderVM): string {
    const table = String((order as any)?.tableName || '').trim();
    const alias = String(order?.alias || '').trim();
    // El nombre de la mesa ya viene completo («Mesa 4», «Terraza 2»).
    return table || alias || `Orden ${order.name}`;
  }

  updateKitchenItem(event: {
    order: OrderVM;
    item: any;
    kitchenStatus: 'Pendiente' | 'En preparacion' | 'Listo' | 'Entregado';
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

  /**
   * Manda el rol de negocio del contexto. Los roles Frappe solo se consultan si el
   * contexto no trae rol (antes `admin` o `cocina` en cualquiera de ellos decidía la vista).
   */
  private detectRole(): RoleName {
    const fromRole = (value: string): RoleName | null => {
      switch (this.normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')) {
        case 'cocina': return 'Cocina';
        case 'administrador':
        case 'gerente': return 'Gerente';
        case 'cajero': return 'Cajero';
        case 'mesero': return 'Mesero';
        default: return null;
      }
    };

    const businessRole = this.capabilities.businessRole;
    if (businessRole) return fromRole(businessRole) ?? 'Desconocido';

    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
      for (const role of roles) {
        const match = fromRole(role);
        if (match) return match;
      }
    } catch { /* sin datos de usuario: rol desconocido */ }
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
