import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';

type CashTab = 'openings' | 'withdrawals' | 'closings' | 'summary';

@Component({
  selector: 'app-cash-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-management.component.html',
  styleUrls: ['./cash-management.component.css']
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
    const features = this.capabilities.features;
    return features.restaurant === true
      && features.restaurant_pos === true
      && features.cash_register === true
      && (this.capabilities.hasPermission('*') || this.capabilities.hasPermission('restaurant.manage'));
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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private errorMessage(error: any): string {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    if (status === 403) return 'Solo un gerente o administrador puede consultar toda la gestión de caja';
    const payload = error?.error ?? error;
    const message = payload?.message ?? payload?.msg ?? payload?._server_messages;
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') return String(message.message || message.error || 'No se pudo consultar la gestión de caja.');
    return 'No se pudo consultar la gestión de caja.';
  }
}
