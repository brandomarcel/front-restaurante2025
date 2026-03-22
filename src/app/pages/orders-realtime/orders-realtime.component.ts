import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';

import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { PrintService } from 'src/app/services/print.service';

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

  total$ = this.rt.streamTotal();
  private sub = new Subscription();
  private pendingActions = new Set<string>();
  private readonly baseUrl = environment.URL;

  constructor(
    private rt: RealtimeOrdersService,
    private ordersApi: OrdersService,
    private utils: UtilsService,
    private router: Router,
    private printService: PrintService
  ) {}

  ngOnInit(): void {
    this.roleName = this.detectRole();
    this.viewMode = this.roleName === 'Cocina' ? 'cocina' : 'normal';
    this.statusFilter = this.viewMode === 'cocina' ? 'ACTIVAS' : 'ALL';

    const today = this.utils.getSoloFechaEcuador();
    this.rt.loadInitial(80, 0, today, today);

    this.sub.add(
      this.rt.streamOrders().subscribe(list => {
        this.orders = list ?? [];
      })
    );

    this.sub.add(
      this.rt.streamNewCount().subscribe(n => this.newCount = n)
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggleModoCocina() {
    this.setViewMode(this.viewMode === 'normal' ? 'cocina' : 'normal');
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    this.statusFilter = mode === 'cocina' ? 'ACTIVAS' : 'ALL';
    this.kitchenOnlyUrgent = false;
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
    this.rt.loadInitial(80, 0, today, today, undefined, true);
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

  get isCocinaOnly(): boolean {
    return this.roleName === 'Cocina';
  }

  get canSwitchView(): boolean {
    return !this.isCocinaOnly;
  }

  get headerSubtitle(): string {
    if (this.isCocinaOnly) {
      return this.kitchenOnlyUrgent
        ? 'Monitor de cocina activo. Mostrando solo ordenes urgentes.'
        : 'Monitor de cocina activo. Prioriza ordenes nuevas y en preparacion.';
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
    const list = this.kitchenBaseOrders.filter(o => this.normalizeStatus(o.status) === 'Ingresada');
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenPreparacion(): OrderVM[] {
    const list = this.filteredOrders.filter(o => this.normalizeStatus(o.status) === 'Preparación');
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenCerradas(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.normalizeStatus(o.status) === 'Cerrada');
    return this.sortKitchenOrders(list);
  }

  get kitchenPreparacionVisible(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter(o => this.normalizeStatus(o.status) === 'PreparaciÃ³n');
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenActivasCount(): number {
    return this.kitchenIngresadas.length + this.kitchenPreparacionSafe.length;
  }

  get kitchenPreparacionSafe(): OrderVM[] {
    const list = this.kitchenBaseOrders.filter((o) => this.normalize(o.status).includes('prepar'));
    return this.sortKitchenOrders(this.applyKitchenUrgentFilter(list));
  }

  get kitchenUrgentesCount(): number {
    const active = this.kitchenBaseOrders.filter((o) => {
      const status = this.normalizeStatus(o.status);
      return status === 'Ingresada' || status === 'Preparación';
    });
    return active.filter((o) => this.isUrgentOrder(o)).length;
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
    return status === filter;
  }

  private normalizeStatus(raw?: string): 'Ingresada' | 'Preparación' | 'Cerrada' | string {
    const value = this.normalize(raw);

    if (value.includes('ingres')) return 'Ingresada';
    if (value.includes('prepar')) return 'Preparación';
    if (value.includes('cerr') || value.includes('lista') || value.includes('entreg')) return 'Cerrada';

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

  private detectRole(): RoleName {
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

}
