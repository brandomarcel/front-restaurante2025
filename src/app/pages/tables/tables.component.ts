import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { OrdersService } from 'src/app/services/orders.service';
import { RestaurantRealtimeEvent, RestaurantRealtimeService } from 'src/app/services/restaurant-realtime.service';

type TableStatus = 'Libre' | 'Ocupada' | 'Reservada' | 'Inactiva';

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './tables.component.html'
})
export class TablesComponent implements OnInit, OnDestroy {
  tables: any[] = [];
  activeOrders: any[] = [];
  selectedTable: any | null = null;
  selectedOrders: any[] = [];
  loading = false;
  loadingOrders = false;
  saving = false;
  showForm = false;
  editingTable: any | null = null;
  showInactive = false;
  error = '';
  readonly statuses: TableStatus[] = ['Libre', 'Ocupada', 'Reservada', 'Inactiva'];
  readonly activeOrderStatuses = new Set(['INGRESADA', 'PREPARACION', 'LISTA']);
  tableForm: FormGroup;
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
    this.refresh();
  }

  ngOnDestroy(): void {
    this.realtimeSub.unsubscribe();
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
      this.activeOrders = index >= 0
        ? this.activeOrders.map((order, i) => i === index ? { ...order, ...row } : order)
        : [...this.activeOrders, row];
    } else if (index >= 0) {
      this.activeOrders = this.activeOrders.filter((_, i) => i !== index);
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
    const mode = String(this.capabilities.business?.business_mode ?? '').trim().toLowerCase();
    return this.capabilities.isEnabled('tables') || mode === 'restaurant' || mode === 'restaurante';
  }

  get canManageTables(): boolean {
    const role = this.normalized(this.capabilities.businessRole);
    return ['ADMINISTRADOR', 'GERENTE'].includes(role);
  }

  get canCreateOrders(): boolean {
    const role = this.normalized(this.capabilities.businessRole);
    return this.capabilities.isEnabled('orders') && ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'MESERO'].includes(role);
  }

  get visibleTables(): any[] {
    return this.tables.filter((table) => this.showInactive || !this.isInactive(table));
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
        this.activeOrders = this.readRows(response).filter((order) => this.isActiveOrder(order));
        this.updateSelectedOrders();
      },
      error: (error) => this.showRequestError(error, false)
    });
  }

  selectTable(table: any): void {
    this.selectedTable = table;
    this.updateSelectedOrders();
    if (this.isOccupied(table) && !this.activeOrders.length && !this.loadingOrders) this.refreshActiveOrders();
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

  statusClass(table: any): string {
    switch (this.tableStatus(table)) {
      case 'Ocupada': return 'border-orange-200 bg-orange-50 text-orange-800';
      case 'Reservada': return 'border-violet-200 bg-violet-50 text-violet-800';
      case 'Inactiva': return 'border-slate-200 bg-slate-100 text-slate-500';
      default: return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    }
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

  private updateSelectedOrders(): void {
    const tableName = String(this.selectedTable?.name || '').trim();
    this.selectedOrders = tableName
      ? this.activeOrders.filter((order) => String(order?.table ?? order?.mesa ?? '').trim() === tableName)
      : [];
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
    toast.error('No tiene permisos para administrar mesas u órdenes en este negocio.');
    return false;
  }

  private normalized(value: any): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private showRequestError(error: any, setPageError = true): void {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    const message = status === 403
      ? 'No tiene permisos para administrar mesas u órdenes en este negocio.'
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
