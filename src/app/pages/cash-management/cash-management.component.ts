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

    this.cajasService.getCashRegisterHistory().pipe(
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
    this.filters = { user: '', status: '', fromDate: '', toDate: '' };
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
