import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';

interface ClosingFilters {
  user: string;
  status: string;
  from_date: string;
  to_date: string;
}

@Component({
  selector: 'app-report-cierre-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './report-cierre-caja.component.html',
  styleUrl: './report-cierre-caja.component.css'
})
export class ReportCierreCajaComponent implements OnInit, OnDestroy {
  readonly filters: ClosingFilters = { user: '', status: '', from_date: '', to_date: '' };
  columns: any[] = [];
  rows: any[] = [];
  loading = false;
  exporting = false;
  errorMessage = '';
  businessId = '';
  private readonly onDataChanged = () => this.buscar();

  constructor(
    private readonly cajasService: CajasService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly alertService: AlertService
  ) {}

  get canView(): boolean {
    return this.capabilities.isEnabled('cash_register')
      && (this.capabilities.hasPermission('*')
        || this.capabilities.hasPermission('restaurant.manage')
        || this.capabilities.hasPermission('billing.manage'));
  }

  get canExport(): boolean {
    return this.canView && !this.loading && !this.exporting;
  }

  ngOnInit(): void {
    this.businessId = this.capabilities.activeBusinessId || '';
    if (!this.canView) {
      this.errorMessage = 'No tienes permiso para consultar este reporte.';
      return;
    }
    window.addEventListener('facturada:restaurant-data-changed', this.onDataChanged);
    this.buscar();
  }

  ngOnDestroy(): void {
    window.removeEventListener('facturada:restaurant-data-changed', this.onDataChanged);
  }

  buscar(): void {
    const currentBusiness = this.capabilities.activeBusinessId || '';
    if (!currentBusiness || !this.canView) {
      this.businessId = currentBusiness;
      this.rows = [];
      this.columns = [];
      this.errorMessage = 'No tienes permiso para consultar este reporte.';
      return;
    }
    this.businessId = currentBusiness;
    this.errorMessage = '';
    this.rows = [];
    this.columns = [];
    this.loading = true;
    this.cajasService.getCashClosingsReport({ ...this.filters, limit: 100 })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response: any) => {
          const message = response?.message ?? response ?? {};
          this.columns = Array.isArray(message.columns) ? message.columns : [];
          const result = Array.isArray(message.result) ? message.result : [];
          this.rows = result.map((row: any) => this.normalizeRow(row));
        },
        error: (error: any) => {
          this.rows = [];
          this.columns = [];
          this.errorMessage = this.readError(error);
        }
      });
  }

  exportarExcel(): void {
    if (!this.canExport) return;
    this.exporting = true;
    this.errorMessage = '';
    this.cajasService.exportCashClosingsReport(this.filters)
      .pipe(finalize(() => this.exporting = false))
      .subscribe({
        next: (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `cierre-caja-${this.businessId}.xlsx`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        },
        error: (error: any) => {
          this.errorMessage = this.readError(error);
          this.alertService.error(this.errorMessage);
        }
      });
  }

  cell(row: any, ...keys: string[]): any {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null) return row[key];
    }
    return null;
  }

  display(row: any, ...keys: string[]): string {
    const value = this.cell(row, ...keys);
    return value === undefined || value === null || value === '' ? '—' : String(value);
  }

  money(row: any, ...keys: string[]): number | null {
    const value = this.cell(row, ...keys);
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  trackByRow = (index: number, row: any) => this.display(row, 'name', 'cierre', 'cash_closing') || index;

  clearFilters(): void {
    this.filters.user = '';
    this.filters.status = '';
    this.filters.from_date = '';
    this.filters.to_date = '';
    this.buscar();
  }

  get totalDiferencia(): number {
    return this.rows.reduce((acc, row) => acc + (this.money(row, 'diferencia', 'difference') || 0), 0);
  }

  get totalRetiradoSum(): number {
    return this.rows.reduce((acc, row) => acc + (this.money(row, 'total_retiros', 'withdrawals', 'retiros') || 0), 0);
  }

  get cierresConDiferencia(): number {
    return this.rows.filter((row) => Math.abs(this.money(row, 'diferencia', 'difference') || 0) > 0.009).length;
  }

  diferenciaClass(value: number | null): string {
    if (value === null || Math.abs(value) < 0.009) return 'text-foreground';
    return value > 0 ? 'text-emerald-600' : 'text-red-600';
  }

  statusBadgeClass(status: string): string {
    const normalized = String(status || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
    if (['confirmado', 'cerrada', 'cerrado', 'completado'].includes(normalized)) return 'badge-green';
    if (['cancelado', 'cancelada', 'anulado', 'anulada', 'rechazado'].includes(normalized)) return 'badge-red';
    if (['borrador', 'pendiente', 'abierta'].includes(normalized)) return 'badge-yellow';
    return 'badge-gray';
  }

  private normalizeRow(row: any): any {
    if (!Array.isArray(row)) return row || {};
    const normalized: Record<string, any> = {};
    const fallbackKeys = [
      'cierre', 'fecha_cierre', 'usuario', 'apertura', 'monto_apertura',
      'efectivo_sistema', 'efectivo_real', 'total_retiros', 'diferencia',
      'estado', 'observaciones'
    ];
    this.columns.forEach((column: any, index: number) => {
      const key = String(column?.fieldname || column?.field || column?.key || column?.label || index);
      normalized[key] = row[index];
      if (fallbackKeys[index] && normalized[fallbackKeys[index]] === undefined) {
        normalized[fallbackKeys[index]] = row[index];
      }
    });
    return normalized;
  }

  private readError(error: any): string {
    const status = Number(error?.status || error?.error?.status || 0);
    if (status === 403) return 'No tienes permiso para consultar este reporte.';
    const payload = error?.error ?? error;
    const direct = payload?.message || payload?.msg || payload?.sri_message;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    if (Array.isArray(direct)) return direct.join(', ');
    const serverMessages = payload?._server_messages;
    if (serverMessages) {
      try {
        const parsed = typeof serverMessages === 'string' ? JSON.parse(serverMessages) : serverMessages;
        const values = Array.isArray(parsed) ? parsed : [parsed];
        const text = values.map((item: any) => {
          if (typeof item === 'string') {
            try { return JSON.parse(item)?.message || item; } catch { return item; }
          }
          return item?.message || item;
        }).filter(Boolean).join(' ');
        if (text) return text;
      } catch { /* el mensaje plano es suficiente */ }
    }
    return status === 400 ? 'Los filtros enviados no son válidos.' : 'No se pudo cargar el reporte.';
  }
}
