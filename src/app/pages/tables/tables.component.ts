import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { OrdersService } from 'src/app/services/orders.service';
import { RestaurantRealtimeEvent, RestaurantRealtimeService } from 'src/app/services/restaurant-realtime.service';

type TableStatus = 'Libre' | 'Ocupada' | 'Reservada' | 'Inactiva';

/** Resumen de las órdenes activas de una mesa, recalculado al cambiar las órdenes */
interface TableOrderSummary {
  count: number;
  total: number;
  since: number | null;
  ready: boolean;
  waiter: string;
}

const EMPTY_SUMMARY: TableOrderSummary = { count: 0, total: 0, since: null, ready: false, waiter: '' };

/** Sillas dibujadas alrededor de la mesa según su capacidad */
interface ChairLayout {
  top: number[];
  bottom: number[];
  sides: boolean;
}

/** Capacidad máxima representada con sillas; mesas más grandes se dibujan igual que esta */
const MAX_DRAWN_CHAIRS = 10;
const chairLayouts = new Map<number, ChairLayout>();

/** 1–3: arriba/abajo · 4+: una a cada lado y el resto repartido arriba/abajo */
function buildChairLayout(capacity: number): ChairLayout {
  const seats = Math.min(Math.max(Math.floor(capacity) || 1, 1), MAX_DRAWN_CHAIRS);
  const sides = seats >= 4;
  const rest = seats - (sides ? 2 : 0);
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  return { top: range(Math.ceil(rest / 2)), bottom: range(Math.floor(rest / 2)), sides };
}
/** A partir de este tiempo una mesa ocupada se resalta como demorada */
const LONG_STAY_MINUTES = 60;
const CLOCK_TICK_MS = 30_000;

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AngularSvgIconModule],
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.css'
})
export class TablesComponent implements OnInit, OnDestroy {
  tables: any[] = [];
  activeOrders: any[] = [];
  selectedTable: any | null = null;
  selectedOrders: any[] = [];
  showTablePopup = false;
  loading = false;
  loadingOrders = false;
  saving = false;
  showForm = false;
  editingTable: any | null = null;
  showInactive = false;
  tableSearch = '';
  statusFilter: 'Todas' | TableStatus = 'Todas';
  error = '';
  readonly statuses: TableStatus[] = ['Libre', 'Ocupada', 'Reservada', 'Inactiva'];
  readonly activeOrderStatuses = new Set(['INGRESADA', 'PREPARACION', 'LISTA']);
  readonly statusFilters: { value: 'Todas' | TableStatus; label: string }[] = [
    { value: 'Todas', label: 'Todas' },
    { value: 'Libre', label: 'Libres' },
    { value: 'Ocupada', label: 'Ocupadas' },
    { value: 'Reservada', label: 'Reservadas' },
  ];
  tableForm: FormGroup;
  /** Reloj compartido para los tiempos de ocupación; avanza cada 30 s */
  now = Date.now();
  private orderSummaries = new Map<string, TableOrderSummary>();
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private readonly realtimeSub = new Subscription();

  constructor(
    private fb: FormBuilder,
    private orders: OrdersService,
    private router: Router,
    public capabilities: CompanyCapabilitiesService,
    private restaurantRealtime: RestaurantRealtimeService
  ) {
    this.tableForm = this.fb.group({
      name: [''],
      table_name: ['', [Validators.required, Validators.maxLength(80)]],
      capacity: [4, [Validators.required, Validators.min(1), Validators.max(999)]],
      status: ['Libre', Validators.required],
      active: [1],
      assigned_waiter: [''],
      notes: ['', Validators.maxLength(300)]
    });
  }

  ngOnInit(): void {
    if (!this.hasTablesModule) {
      this.error = 'El módulo de mesas no está habilitado para este negocio.';
      return;
    }
    this.restaurantRealtime.activate();
    this.realtimeSub.add(this.restaurantRealtime.events$.subscribe((event) => this.applyRealtimeEvent(event)));
    this.realtimeSub.add(this.restaurantRealtime.reconnected$.subscribe(() => this.refresh()));
    this.clockTimer = setInterval(() => this.now = Date.now(), CLOCK_TICK_MS);
    this.refresh();
  }

  ngOnDestroy(): void {
    this.realtimeSub.unsubscribe();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showForm) this.closeForm();
    else if (this.showTablePopup) this.closeTablePopup();
  }

  private applyRealtimeEvent(event: RestaurantRealtimeEvent): void {
    if (event.event_type === 'table.created' || event.event_type === 'table.updated') {
      const incoming = this.normalizeTable(event.data);
      const name = String(incoming?.name || '').trim();
      if (!name) return;
      const index = this.tables.findIndex((table) => String(table?.name || '') === name);
      if (index >= 0) {
        this.tables = this.tables.map((table, i) => i === index ? { ...table, ...incoming } : table);
      } else if (this.showInactive || !this.isInactive(incoming)) {
        this.tables = [...this.tables, incoming];
      }
      if (this.selectedTable?.name === name) {
        this.selectedTable = this.tables.find((table) => table.name === name) || incoming;
        this.updateSelectedOrders();
      }
      return;
    }

    if (event.event_type !== 'order.created' && event.event_type !== 'order.updated') return;
    const incoming = event.data || {};
    const name = String(incoming?.name || '').trim();
    if (!name) return;
    const index = this.activeOrders.findIndex((order) => String(order?.name || '') === name);
    const active = this.isActiveOrder(incoming);
    if (active) {
      const row = index >= 0 ? { ...this.activeOrders[index], ...incoming } : { ...incoming };
      this.setActiveOrders(index >= 0
        ? this.activeOrders.map((order, i) => i === index ? { ...order, ...row } : order)
        : [...this.activeOrders, row]);
    } else if (index >= 0) {
      this.setActiveOrders(this.activeOrders.filter((_, i) => i !== index));
    }
    // El backend normalmente publica también table.updated. Este ajuste
    // inmediato evita que la tarjeta quede atrasada mientras llega ese evento.
    const rawTable = incoming?.table ?? incoming?.mesa ?? incoming?.table_name;
    const tableName = String(typeof rawTable === 'object' ? rawTable?.name : rawTable || '').trim();
    const tableIndex = this.tables.findIndex((table) => String(table?.name || '') === tableName);
    if (tableIndex >= 0) {
      const nextStatus = active ? 'Ocupada' : (this.normalized(incoming?.status).includes('CANCEL') || this.normalized(incoming?.status).includes('CERR') ? 'Libre' : undefined);
      if (nextStatus) {
        this.tables = this.tables.map((table, i) => i === tableIndex ? { ...table, status: nextStatus, active: 1 } : table);
      }
    }
    this.updateSelectedOrders();
  }

  get hasTablesModule(): boolean {
    return this.capabilities.isEnabled('tables');
  }

  get canManageTables(): boolean {
    return this.capabilities.hasPermission('*')
      || this.capabilities.hasPermission('restaurant.manage')
      || this.capabilities.hasPermission('restaurant.tables.manage');
  }

  get canCreateOrders(): boolean {
    return this.capabilities.features.restaurant === true
      && this.capabilities.hasPermission('restaurant.orders.create');
  }

  get visibleTables(): any[] {
    return this.tables.filter((table) => this.showInactive || !this.isInactive(table));
  }

  get filteredTables(): any[] {
    const query = this.normalized(this.tableSearch);
    return this.visibleTables.filter((table) => {
      const matchesStatus = this.statusFilter === 'Todas' || this.tableStatus(table) === this.statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return this.normalized(`${this.tableLabel(table)} ${table?.assigned_waiter || ''}`).includes(query);
    });
  }

  get freeTablesCount(): number {
    return this.visibleTables.filter((table) => this.isFree(table)).length;
  }

  get occupiedTablesCount(): number {
    return this.visibleTables.filter((table) => this.isOccupied(table)).length;
  }

  get reservedTablesCount(): number {
    return this.visibleTables.filter((table) => this.isReserved(table)).length;
  }

  get inactiveTablesCount(): number {
    return this.visibleTables.filter((table) => this.isInactive(table)).length;
  }

  get statusCounts(): Record<'Todas' | TableStatus, number> {
    return {
      Todas: this.visibleTables.length,
      Libre: this.freeTablesCount,
      Ocupada: this.occupiedTablesCount,
      Reservada: this.reservedTablesCount,
      Inactiva: this.inactiveTablesCount,
    };
  }

  /** Ingreso abierto en el salón: suma de las cuentas activas */
  get openTotal(): number {
    let total = 0;
    this.orderSummaries.forEach((summary) => total += summary.total);
    return total;
  }

  summary(table: any): TableOrderSummary {
    return this.orderSummaries.get(String(table?.name || '').trim()) || EMPTY_SUMMARY;
  }

  tableOrderCount(table: any): number {
    return this.summary(table).count;
  }

  chairLayout(table: any): ChairLayout {
    const capacity = Math.min(Number(table?.capacity) || 1, MAX_DRAWN_CHAIRS);
    let layout = chairLayouts.get(capacity);
    if (!layout) {
      layout = buildChairLayout(capacity);
      chairLayouts.set(capacity, layout);
    }
    return layout;
  }

  statusKey(table: any): 'free' | 'busy' | 'reserved' | 'inactive' {
    switch (this.tableStatus(table)) {
      case 'Ocupada': return 'busy';
      case 'Reservada': return 'reserved';
      case 'Inactiva': return 'inactive';
      default: return 'free';
    }
  }

  elapsedMinutes(since: number | null): number {
    return since ? Math.max(0, Math.floor((this.now - since) / 60_000)) : 0;
  }

  elapsedLabel(since: number | null): string {
    if (!since) return '';
    const minutes = this.elapsedMinutes(since);
    if (minutes < 1) return 'Recién';
    if (minutes < 60) return `${minutes} min`;
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
  }

  isLongStay(table: any): boolean {
    return this.isOccupied(table) && this.elapsedMinutes(this.summary(table).since) >= LONG_STAY_MINUTES;
  }

  orderSince(order: any): number | null {
    return this.parseDate(order?.creation);
  }

  orderStatusLabel(order: any): string {
    switch (this.normalized(order?.status)) {
      case 'INGRESADA': return 'Ingresada';
      case 'PREPARACION': return 'En cocina';
      case 'LISTA': return 'Lista para servir';
      default: return String(order?.status || '');
    }
  }

  isReadyOrder(order: any): boolean {
    return this.normalized(order?.status) === 'LISTA';
  }

  orderItemsCount(order: any): number {
    return Array.isArray(order?.items) ? order.items.reduce((sum: number, item: any) => sum + (Number(item?.qty) || 0), 0) : 0;
  }

  trackByName(_: number, row: any): string {
    return String(row?.name || '');
  }

  /**
   * Acción principal de un toque, como en los POS de salón: mesa libre abre una
   * orden, mesa ocupada con una sola orden la abre; el resto muestra el detalle.
   */
  onTableTap(table: any): void {
    if (this.isFree(table) && this.canCreateOrders) {
      this.selectedTable = table;
      this.openNewOrder();
      return;
    }
    if (this.isOccupied(table)) {
      const orders = this.ordersForTable(table);
      if (orders.length === 1) {
        this.openOrder(orders[0]);
        return;
      }
    }
    this.selectTable(table);
  }

  refresh(): void {
    if (!this.hasTablesModule) return;
    this.loading = true;
    this.error = '';
    this.orders.getTables(this.showInactive ? null : true).pipe(finalize(() => this.loading = false)).subscribe({
      next: (response: any) => {
        this.tables = this.readRows(response).map((table) => this.normalizeTable(table));
        if (this.selectedTable) {
          this.selectedTable = this.tables.find((table) => table.name === this.selectedTable.name) || null;
        }
        this.refreshActiveOrders();
      },
      error: (error) => this.showRequestError(error)
    });
  }

  refreshActiveOrders(): void {
    this.loadingOrders = true;
    this.orders.getAll(100, 0).pipe(finalize(() => this.loadingOrders = false)).subscribe({
      next: (response: any) => {
        this.setActiveOrders(this.readRows(response).filter((order) => this.isActiveOrder(order)));
      },
      error: (error) => this.showRequestError(error, false)
    });
  }

  selectTable(table: any): void {
    this.selectedTable = table;
    this.updateSelectedOrders();
    this.showTablePopup = true;
    if (this.isOccupied(table) && !this.activeOrders.length && !this.loadingOrders) this.refreshActiveOrders();
  }

  closeTablePopup(): void {
    this.showTablePopup = false;
  }

  openCreate(): void {
    if (!this.ensureTableManagement()) return;
    this.editingTable = null;
    this.tableForm.reset({ name: '', table_name: '', capacity: 4, status: 'Libre', active: 1, assigned_waiter: '', notes: '' });
    this.showForm = true;
  }

  openEdit(table: any = this.selectedTable): void {
    if (!table || !this.ensureTableManagement()) return;
    this.editingTable = table;
    this.tableForm.reset({
      name: table.name,
      table_name: table.table_name,
      capacity: Number(table.capacity || 1),
      status: this.tableStatus(table),
      active: this.isInactive(table) ? 0 : 1,
      assigned_waiter: table.assigned_waiter || '',
      notes: table.notes || ''
    });
    this.showForm = true;
  }

  closeForm(): void {
    if (!this.saving) this.showForm = false;
  }

  saveTable(): void {
    if (!this.ensureTableManagement()) return;
    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      toast.error('Completa el nombre y la capacidad de la mesa.');
      return;
    }
    const raw = this.tableForm.getRawValue();
    const requestedStatus = String(raw.status || 'Libre') as TableStatus;
    // Una mesa inactiva no puede quedar simultáneamente activa; se normaliza
    // antes de enviar para que la tarjeta y el backend representen lo mismo.
    const active = requestedStatus === 'Inactiva' ? 0 : (Number(raw.active) ? 1 : 0);
    const payload = {
      ...(this.editingTable ? { name: this.editingTable.name } : {}),
      table_name: String(raw.table_name || '').trim(),
      capacity: Number(raw.capacity),
      status: active ? requestedStatus : 'Inactiva',
      active,
      assigned_waiter: String(raw.assigned_waiter || '').trim() || null,
      notes: String(raw.notes || '').trim()
    };
    this.saving = true;
    const request$ = this.editingTable ? this.orders.updateTable(payload) : this.orders.createTable(payload);
    request$.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        toast.success(this.editingTable ? 'Mesa actualizada.' : 'Mesa creada.');
        this.showForm = false;
        this.refresh();
        this.notifyRestaurantChanged();
      },
      error: (error) => this.showRequestError(error)
    });
  }

  releaseReservation(): void {
    const table = this.selectedTable;
    if (!table || !this.isReserved(table) || !this.ensureTableManagement()) return;
    this.updateTableStatus(table, 'Libre');
  }

  openNewOrder(): void {
    const table = this.selectedTable;
    if (!table || !this.isFree(table)) return;
    if (!this.canCreateOrders) {
      toast.error('No tiene permisos para crear órdenes en este negocio.');
      return;
    }
    this.router.navigate(['/dashboard/pos'], { queryParams: { table: table.name, table_label: this.tableLabel(table) } });
  }

  openOrder(order: any): void {
    const name = String(order?.name || '').trim();
    if (name) this.router.navigate(['/dashboard/orders', name]);
  }

  tableLabel(table: any): string {
    const number = String(table?.number_mesa || '').trim();
    const name = String(table?.table_name || table?.display_name || '').trim();
    return number && name && number !== name ? `${number} · ${name}` : (name || number || 'Mesa');
  }

  tableStatus(table: any): TableStatus {
    const status = this.normalized(table?.status);
    if (!Number(table?.active ?? table?.isactive ?? 1) || status === 'INACTIVA') return 'Inactiva';
    if (status === 'OCUPADA') return 'Ocupada';
    if (status === 'RESERVADA') return 'Reservada';
    return 'Libre';
  }

  isFree(table: any): boolean { return this.tableStatus(table) === 'Libre'; }
  isOccupied(table: any): boolean { return this.tableStatus(table) === 'Ocupada'; }
  isReserved(table: any): boolean { return this.tableStatus(table) === 'Reservada'; }
  isInactive(table: any): boolean { return this.tableStatus(table) === 'Inactiva'; }

  private updateTableStatus(table: any, status: TableStatus): void {
    this.saving = true;
    this.orders.updateTable({
      name: table.name,
      table_name: table.table_name,
      capacity: table.capacity,
      status,
      active: status === 'Inactiva' ? 0 : 1,
      assigned_waiter: table.assigned_waiter || null,
      notes: table.notes || ''
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        toast.success('Mesa liberada.');
        this.refresh();
        this.notifyRestaurantChanged();
      },
      error: (error) => this.showRequestError(error)
    });
  }

  private setActiveOrders(orders: any[]): void {
    this.activeOrders = orders;
    const summaries = new Map<string, TableOrderSummary>();
    for (const order of orders) {
      const tableName = this.orderTableName(order);
      if (!tableName) continue;
      const current = summaries.get(tableName) || { ...EMPTY_SUMMARY };
      const since = this.orderSince(order);
      summaries.set(tableName, {
        count: current.count + 1,
        total: current.total + (Number(order?.total) || 0),
        since: since && (!current.since || since < current.since) ? since : current.since,
        ready: current.ready || this.isReadyOrder(order),
        waiter: current.waiter || String(order?.waiter || '').trim(),
      });
    }
    this.orderSummaries = summaries;
    this.updateSelectedOrders();
  }

  private ordersForTable(table: any): any[] {
    const tableName = String(table?.name || '').trim();
    return tableName ? this.activeOrders.filter((order) => this.orderTableName(order) === tableName) : [];
  }

  private orderTableName(order: any): string {
    const raw = order?.table ?? order?.mesa;
    return String(typeof raw === 'object' ? raw?.name : raw || '').trim();
  }

  /** Frappe entrega fechas "YYYY-MM-DD HH:mm:ss[.ffffff]" en hora del servidor */
  private parseDate(value: any): number | null {
    if (!value) return null;
    const time = new Date(String(value).replace(' ', 'T').slice(0, 23)).getTime();
    return Number.isFinite(time) ? time : null;
  }

  private updateSelectedOrders(): void {
    this.selectedOrders = this.ordersForTable(this.selectedTable);
  }

  private isActiveOrder(order: any): boolean {
    return this.activeOrderStatuses.has(this.normalized(order?.status));
  }

  private normalizeTable(table: any): any {
    return {
      ...table,
      table_name: table?.table_name ?? table?.nombre ?? table?.number_mesa ?? table?.name,
      capacity: Number(table?.capacity ?? 0) || 0,
      active: table?.active ?? table?.isactive ?? 1,
      assigned_waiter: table?.assigned_waiter ?? table?.mesero ?? null
    };
  }

  private readRows(response: any): any[] {
    const message = response?.message ?? response ?? {};
    return Array.isArray(message?.data) ? message.data : (Array.isArray(response?.data) ? response.data : []);
  }

  private ensureTableManagement(): boolean {
    if (this.canManageTables) return true;
    toast.error('No tienes permiso para realizar esta operación.');
    return false;
  }

  private normalized(value: any): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private showRequestError(error: any, setPageError = true): void {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    const message = status === 403
      ? 'No tienes permiso para realizar esta operación.'
      : this.backendMessage(error);
    if (setPageError) this.error = message;
    toast.error(message);
  }

  private backendMessage(error: any): string {
    const payload = error?.error ?? error ?? {};
    try {
      const raw = payload?._server_messages;
      if (raw) {
        const messages = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const first = Array.isArray(messages) ? messages[0] : messages;
        const value = typeof first === 'string' ? JSON.parse(first) : first;
        if (value?.message) return String(value.message);
      }
    } catch { /* usar mensaje normal */ }
    const candidate = payload?.message ?? payload?.sri_message ?? payload?.exception ?? error?.message;
    if (typeof candidate === 'string' && candidate.includes(':')) {
      return candidate.split(':').slice(1).join(':').trim() || 'No se pudo completar la operación.';
    }
    return String(candidate || 'No se pudo completar la operación.');
  }

  private notifyRestaurantChanged(): void {
    window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
  }
}
