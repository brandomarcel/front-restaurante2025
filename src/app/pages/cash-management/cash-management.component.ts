import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';
import { CajaNavComponent } from 'src/app/shared/components/caja-nav/caja-nav.component';
import { cashDifferenceKind, cashNumber, isClosedCashStatus, isForbidden, normalizeCashStatus } from 'src/app/core/utils/cash-register';

type CashTab = 'openings' | 'withdrawals' | 'closings';

@Component({
  selector: 'app-cash-management',
  imports: [CommonModule, FormsModule, CajaNavComponent],
  templateUrl: './cash-management.component.html'
})
export class CashManagementComponent implements OnInit, OnDestroy {
  activeTab: CashTab = 'openings';
  openings: any[] = [];
  withdrawals: any[] = [];
  closings: any[] = [];
  summary: any = {};
  /** Filas con el detalle abierto (por nombre del documento). */
  expanded = new Set<string>();
  loading = false;
  error = '';

  filters = {
    user: '',
    status: '',
    fromDate: '',
    toDate: ''
  };
  private readonly onCashChanged = () => this.loadHistory();

  constructor(
    private cajasService: CajasService,
    private alertService: AlertService,
    public capabilities: CompanyCapabilitiesService
  ) { }

  ngOnInit(): void {
    if (!this.canView) return;
    window.addEventListener('facturada:restaurant-data-changed', this.onCashChanged);
    this.loadHistory();
  }

  ngOnDestroy(): void {
    window.removeEventListener('facturada:restaurant-data-changed', this.onCashChanged);
  }

  get canView(): boolean {
    return this.capabilities.isEnabled('cash_register')
      && (this.capabilities.hasPermission('*')
        || this.capabilities.hasPermission('restaurant.manage')
        || this.capabilities.hasPermission('billing.manage'));
  }

  loadHistory(): void {
    if (!this.canView) return;
    this.loading = true;
    this.error = '';
    // Evita conservar datos de otra empresa mientras cambia el contexto.
    this.openings = [];
    this.withdrawals = [];
    this.closings = [];
    this.summary = {};
    this.expanded.clear();

    this.cajasService.getCashRegisterHistory({ fromDate: this.filters.fromDate, toDate: this.filters.toDate }).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (response: any) => {
        const body = response?.message ?? response ?? {};
        const data = body?.data && typeof body.data === 'object' ? body.data : body;
        this.openings = Array.isArray(data?.openings) ? data.openings : [];
        this.withdrawals = Array.isArray(data?.withdrawals) ? data.withdrawals : [];
        this.closings = Array.isArray(data?.closings) ? data.closings : [];
        this.summary = data?.summary && typeof data.summary === 'object' ? data.summary : {};
      },
      error: (error: any) => {
        this.error = this.errorMessage(error);
        this.alertService.error(this.error);
      }
    });
  }

  clearFilters(): void {
    const hadDates = !!(this.filters.fromDate || this.filters.toDate);
    this.filters = { user: '', status: '', fromDate: '', toDate: '' };
    if (hadDates) this.loadHistory();
  }

  /** El rango de fechas se consulta en el backend: así no depende de los últimos 100 registros. */
  onDateRangeChange(): void {
    const { fromDate, toDate } = this.filters;
    if (fromDate && toDate && fromDate > toDate) return;
    this.loadHistory();
  }

  readonly tabs: ReadonlyArray<{ id: CashTab; label: string }> = [
    { id: 'openings', label: 'Aperturas' },
    { id: 'withdrawals', label: 'Retiros' },
    { id: 'closings', label: 'Cierres' }
  ];

  get hasActiveFilters(): boolean {
    return !!(this.filters.user || this.filters.status || this.filters.fromDate || this.filters.toDate);
  }

  /** Usuarios que aparecen en el historial, para elegirlos en vez de escribirlos. */
  get userOptions(): string[] {
    return this.distinct([...this.openings, ...this.withdrawals, ...this.closings].map((row) => this.rowUser(row)));
  }

  /** Estados que existen en la pestaña actual (los retiros y las aperturas usan estados distintos). */
  get statusOptions(): string[] {
    return this.distinct(this.rowsFor(this.activeTab).map((row) => this.rowStatus(row)));
  }

  setTab(tab: CashTab): void {
    this.activeTab = tab;
    // Un estado de otra pestaña dejaría la lista vacía sin motivo aparente.
    if (this.filters.status && !this.statusOptions.includes(this.filters.status)) this.filters.status = '';
  }

  countFor(tab: CashTab): number {
    return this.applyFilters(this.rowsFor(tab)).length;
  }

  statusClass(row: any): string {
    const status = normalizeCashStatus(this.rowStatus(row));
    if (status === 'ABIERTA' || status === 'OPEN') return 'bg-emerald-100 text-emerald-800';
    if (isClosedCashStatus(status)) return 'bg-muted text-muted-foreground';
    if (status === 'BORRADOR' || status === 'DRAFT') return 'bg-amber-100 text-amber-900';
    return 'bg-sky-100 text-sky-800';
  }

  rowDifference(row: any): number {
    return cashNumber(row?.diferencia ?? row?.difference ?? 0);
  }

  differenceClass(value: number): string {
    const kind = cashDifferenceKind(value);
    return kind === 'even' ? 'text-muted-foreground' : (kind === 'short' ? 'text-red-700' : 'text-amber-700');
  }

  get visibleOpenings(): any[] {
    return this.applyFilters(this.openings);
  }

  get visibleWithdrawals(): any[] {
    return this.applyFilters(this.withdrawals);
  }

  get visibleClosings(): any[] {
    return this.applyFilters(this.closings);
  }

  countSummary(...keys: string[]): number {
    return this.toNumber(this.readSummary(...keys));
  }

  moneySummary(...keys: string[]): number {
    return this.toNumber(this.readSummary(...keys));
  }

  textSummary(...keys: string[]): string {
    const value = this.readSummary(...keys);
    return value === null || value === undefined || value === '' ? '0' : String(value);
  }

  isExpanded(row: any): boolean {
    return this.expanded.has(String(row?.name || ''));
  }

  toggleRow(row: any): void {
    const key = String(row?.name || '');
    if (!key) return;
    if (this.expanded.has(key)) this.expanded.delete(key);
    else this.expanded.add(key);
  }

  isOpen(row: any): boolean {
    return normalizeCashStatus(this.rowStatus(row)) === 'ABIERTA';
  }

  terminalLabel(row: any): string {
    return String(row?.terminal_name || row?.pos_terminal || '').trim();
  }

  /** Duración legible del turno, de la apertura al cierre (o a ahora si sigue abierto). */
  duration(from: unknown, to?: unknown): string {
    const start = this.dateValue(from ? String(from) : null);
    if (start === null) return '';
    const end = to ? this.dateValue(String(to)) : Date.now();
    if (end === null || end < start) return '';
    const minutes = Math.floor((end - start) / 60000);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
  }

  /** Cobros de un turno abierto, por forma de pago, tal como los lleva el sistema hasta ahora. */
  openingPayments(row: any): Array<{ method: string; code: string; amount: number }> {
    const rows = Array.isArray(row?.payment_totals) ? row.payment_totals : [];
    return rows.map((item: any) => ({
      method: String(item?.payment_method || 'Otros'),
      code: String(item?.payment_code || ''),
      amount: this.toNumber(item?.amount)
    }));
  }

  openingCashSales(row: any): number {
    return this.openingPayments(row).filter((item) => item.code === '01').reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * Detalle de un cierre por forma de pago. El efectivo se compara contra lo
   * esperado en el cajón (apertura + ventas en efectivo − retiros), no contra
   * las ventas solas, porque lo contado incluye el fondo inicial.
   */
  closingPayments(row: any): Array<{ method: string; code: string; system: number; counted: number; difference: number }> {
    const rows = Array.isArray(row?.payments) ? row.payments : [];
    return rows.map((item: any) => {
      const code = String(item?.payment_code || '');
      const isCash = code === '01';
      const system = isCash ? this.toNumber(row?.cash_system ?? row?.efectivo_sistema) : this.toNumber(item?.system_amount);
      const counted = isCash ? this.toNumber(row?.cash_counted ?? row?.efectivo_real) : this.toNumber(item?.counted_amount);
      return {
        method: String(item?.payment_method || 'Otros'),
        code,
        system,
        counted,
        difference: Math.round((counted - system) * 100) / 100
      };
    });
  }

  /** Ventas del cierre por forma de pago (sin el fondo ni los retiros del efectivo). */
  private closingSales(row: any): Array<{ method: string; code: string; amount: number }> {
    const rows = Array.isArray(row?.payments) ? row.payments : [];
    return rows.map((item: any) => ({
      method: String(item?.payment_method || 'Otros'),
      code: String(item?.payment_code || ''),
      amount: this.toNumber(item?.system_amount)
    }));
  }

  /** Cobrado por forma de pago en lo que se está viendo (turnos abiertos + cierres, según filtros). */
  get salesByMethod(): Array<{ method: string; code: string; amount: number }> {
    const totals = new Map<string, { method: string; code: string; amount: number }>();
    const add = (item: { method: string; code: string; amount: number }) => {
      const key = item.code || item.method;
      const current = totals.get(key);
      if (current) current.amount += item.amount;
      else totals.set(key, { ...item });
    };
    this.visibleOpenings.filter((row) => this.isOpen(row)).forEach((row) => this.openingPayments(row).forEach(add));
    this.visibleClosings.forEach((row) => this.closingSales(row).forEach(add));
    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
  }

  get salesTotal(): number {
    return this.salesByMethod.reduce((sum, item) => sum + item.amount, 0);
  }

  trackByName(index: number, row: any): string | number {
    return row?.name || row?.id || `${this.activeTab}-${index}`;
  }

  rowUser(row: any): string {
    return String(row?.user ?? row?.usuario ?? row?.owner ?? '—');
  }

  rowStatus(row: any): string {
    return String(row?.status ?? row?.estado ?? '—');
  }

  rowDate(row: any): string | null {
    return row?.posted_at ?? row?.fecha_hora ?? row?.opened_at ?? row?.closed_at ?? row?.creation ?? null;
  }

  rowAmount(row: any): number {
    return this.toNumber(row?.amount ?? row?.monto ?? row?.total ?? 0);
  }

  private rowsFor(tab: CashTab): any[] {
    return tab === 'openings' ? this.openings : (tab === 'withdrawals' ? this.withdrawals : this.closings);
  }

  private distinct(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value && value !== '—'))).sort((a, b) => a.localeCompare(b));
  }

  private applyFilters(rows: any[]): any[] {
    const user = this.normalize(this.filters.user);
    const status = this.normalize(this.filters.status);
    const from = this.filters.fromDate ? new Date(`${this.filters.fromDate}T00:00:00`).getTime() : null;
    const to = this.filters.toDate ? new Date(`${this.filters.toDate}T23:59:59`).getTime() : null;

    return rows.filter((row) => {
      const rowUser = this.normalize(this.rowUser(row));
      const rowStatus = this.normalize(this.rowStatus(row));
      const timestamp = this.dateValue(this.rowDate(row));
      return (!user || rowUser.includes(user))
        && (!status || rowStatus === status)
        && (from === null || (timestamp !== null && timestamp >= from))
        && (to === null || (timestamp !== null && timestamp <= to));
    });
  }

  private readSummary(...keys: string[]): unknown {
    for (const key of keys) {
      if (this.summary?.[key] !== undefined && this.summary?.[key] !== null) return this.summary[key];
    }
    return null;
  }

  private dateValue(value: string | null): number | null {
    if (!value) return null;
    const timestamp = new Date(String(value).replace(' ', 'T')).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private normalize(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  private toNumber(value: unknown): number {
    return cashNumber(value);
  }

  private errorMessage(error: any): string {
    if (isForbidden(error)) return 'Solo un gerente o administrador puede consultar toda la gestión de caja';
    const payload = error?.error ?? error;
    const message = payload?.message ?? payload?.msg ?? payload?._server_messages;
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') return String(message.message || message.error || 'No se pudo consultar la gestión de caja.');
    return 'No se pudo consultar la gestión de caja.';
  }
}
