import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { finalize, Subscription } from 'rxjs';
import {
  FrappeQueryReportService,
  FrappeReportColumn
} from 'src/app/services/frappe-query-report.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

import { ReportDefinition, reportDefinitions } from './frappe-report-definitions';

@Component({
  selector: 'app-frappe-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './frappe-reports.component.html'
})
export class FrappeReportsComponent implements OnInit, OnDestroy {
  reports: ReportDefinition[] = reportDefinitions(false);

  selectedReportName = this.reports[0].name;
  filters: Record<string, any> = {};
  columns: FrappeReportColumn[] = [];
  rows: any[] = [];
  private hasTotalRow = false;
  loading = false;
  exporting = false;
  errorMessage = '';
  payments: any[] = [];

  private routeSub?: Subscription;
  private querySub?: Subscription;
  private exportSub?: Subscription;
  private paymentsSub?: Subscription;
  private resultContext?: { business: string | null; report: string; filters: string };

  constructor(
    private route: ActivatedRoute,
    private reportSvc: FrappeQueryReportService,
    private paymentsSvc: PaymentsService,
    private utils: UtilsService,
    private spinner: NgxSpinnerService,
    private capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    this.reports = reportDefinitions(this.capabilities.features.restaurant === true);
    this.reports = this.reports.filter((report) => this.canViewReport(report));
    this.selectedReportName = this.reports[0]?.name || '';
    if (!this.canViewReports() || !this.reports.length) {
      this.errorMessage = 'No tienes permiso para consultar este reporte.';
      return;
    }
    if (this.reports.some((report) => report.filters.some((filter) => filter.type === 'payment'))) {
      this.loadPayments();
    }
    this.routeSub = this.route.data.subscribe((data) => {
      const defaultReport = data?.['defaultReport'];
      this.selectReport(defaultReport || this.selectedReportName, false);
      this.runReport();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.querySub?.unsubscribe();
    this.exportSub?.unsubscribe();
    this.paymentsSub?.unsubscribe();
  }

  get selectedReport(): ReportDefinition {
    return this.reports.find((report) => report.name === this.selectedReportName) || this.reports[0] || this.emptyReport();
  }

  get hasRows(): boolean {
    return this.rows.length > 0;
  }

  get recordCount(): number {
    return Math.max(0, this.rows.length - (this.hasTotalRow ? 1 : 0));
  }

  get displayColumns(): FrappeReportColumn[] {
    if (!this.columns.length) return [];

    const preferred = this.selectedReport.visibleColumns
      .map((key) => this.findColumnByKey(key))
      .filter((column): column is FrappeReportColumn => !!column);

    return preferred.length ? preferred : this.columns.slice(0, 8);
  }

  selectReport(reportName: string, fetch = true): void {
    this.querySub?.unsubscribe();
    this.resultContext = undefined;
    this.hasTotalRow = false;
    if (reportName === 'Orders Report') reportName = 'FacturADA Restaurant Orders';
    if (reportName === 'Ventas por Forma de Pago' && !this.reports.some(report => report.name === reportName)) {
      reportName = 'FacturADA Restaurant Sales by Payment';
    }
    const report = this.reports.find((item) => item.name === reportName) || this.reports[0] || this.emptyReport();
    this.selectedReportName = report.name;
    this.filters = this.buildDefaultFilters(report);
    this.columns = [];
    this.rows = [];
    this.errorMessage = '';
    if (fetch) this.runReport();
  }

  runReport(): void {
    if (!this.canViewReports() || !this.reports.length || !this.canViewReport(this.selectedReport)) {
      this.rows = [];
      this.columns = [];
      this.errorMessage = 'No tienes permiso para consultar este reporte.';
      return;
    }
    if (!this.validateFilters()) return;

    this.querySub?.unsubscribe();
    const business = this.capabilities.activeBusinessId;
    const report = this.selectedReport.name;
    const filters = this.cleanFilters(this.filters);
    this.resultContext = undefined;
    this.hasTotalRow = false;
    this.rows = [];
    this.columns = [];
    this.loading = true;
    this.errorMessage = '';
    this.spinner.show();

    this.querySub = this.reportSvc.run(report, filters)
      .pipe(finalize(() => {
        this.loading = false;
        this.spinner.hide();
      }))
      .subscribe({
        next: (response) => {
          if (business !== this.capabilities.activeBusinessId || report !== this.selectedReport.name) return;
          this.resultContext = { business, report, filters: JSON.stringify(filters) };
          const message = response?.message || {};
          this.hasTotalRow = Number(message['add_total_row']) === 1;
          this.rows = Array.isArray(message.result) ? message.result : [];
          this.columns = this.normalizeColumns(message.columns || []);
          if (!this.columns.length && this.rows.length && !Array.isArray(this.rows[0])) {
            this.columns = Object.keys(this.rows[0]).map((key, index) => ({
              label: this.humanizeKey(key),
              fieldname: key,
              fieldtype: 'Data',
              sourceIndex: index
            }));
          }
        },
        error: (error) => {
          if (business !== this.capabilities.activeBusinessId || report !== this.selectedReport.name) return;
          this.columns = [];
          this.rows = [];
          this.errorMessage = this.readReportError(error);
          toast.error(this.errorMessage);
        }
      });
  }

  clearFilters(): void {
    this.filters = this.buildDefaultFilters(this.selectedReport);
    this.runReport();
  }

  exportExcel(): void {
    if (this.loading || this.exporting || !this.canViewReports() || !this.canViewReport(this.selectedReport) || !this.validateFilters()) return;
    const business = this.capabilities.activeBusinessId;
    const report = this.selectedReport.name;
    const filters = this.cleanFilters(this.filters);
    if (!this.resultContext || this.resultContext.business !== business || this.resultContext.report !== report
      || this.resultContext.filters !== JSON.stringify(filters)) {
      toast.error('Consulta el reporte con los filtros actuales antes de exportar.');
      return;
    }

    if (!this.columns.length) {
      toast.error('Consulta el reporte antes de exportar para identificar las columnas visibles.');
      return;
    }

    this.exporting = true;
    this.spinner.show();

    const filename = this.buildExportFilename();
    this.exportSub = this.reportSvc.exportExcel(report, filters)
      .pipe(finalize(() => {
        this.exporting = false;
        this.spinner.hide();
      }))
      .subscribe({
        next: (blob) => {
          if (business !== this.capabilities.activeBusinessId || report !== this.selectedReport.name) return;
          this.downloadBlob(blob, filename);
          toast.success('Reporte exportado correctamente.');
        },
        error: (error) => {
          toast.error(this.readReportError(error, 'No se pudo exportar el reporte.'));
        }
      });
  }

  trackByColumn = (index: number, column: FrappeReportColumn) => column.fieldname || column.label || index;
  trackByRow = (index: number) => index;

  getCell(row: any, column: FrappeReportColumn, index: number): any {
    if (Array.isArray(row)) return row[this.getSourceColumnIndex(column, index)];
    const fieldname = column.fieldname || '';
    const label = column.label || '';
    return row?.[fieldname] ?? row?.[label] ?? row?.[this.normalizeKey(label)] ?? '';
  }

  isMoneyColumn(column: FrappeReportColumn): boolean {
    const type = String(column.fieldtype || '').toLowerCase();
    if (['int', 'float', 'percent', 'check', 'date', 'datetime'].includes(type)) return false;
    const key = `${column.fieldname || ''} ${column.label || ''}`.toLowerCase();
    return type === 'currency' || /\b(total|subtotal|iva|promedio|cobrado|precio)\b/.test(key);
  }

  isNumericColumn(column: FrappeReportColumn): boolean {
    const type = String(column.fieldtype || '').toLowerCase();
    return ['int', 'float', 'percent'].includes(type);
  }

  isDateColumn(column: FrappeReportColumn): boolean {
    const type = String(column.fieldtype || '').toLowerCase();
    const key = `${column.fieldname || ''} ${column.label || ''}`.toLowerCase();
    return ['date', 'datetime'].includes(type) || key.includes('fecha');
  }

  formatCell(row: any, column: FrappeReportColumn, index: number): string {
    const value = this.getCell(row, column, index);
    if (value === null || value === undefined || value === '') return '—';
    if (column.fieldtype === 'Check') return value === true || value === 1 || value === '1' ? 'Sí' : 'No';
    if (this.isDateColumn(column)) return this.formatDate(value);
    return String(value);
  }

  toNumber(value: any): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  getPaymentLabel(payment: any): string {
    const label = payment?.description || payment?.nombre || payment?.name || 'Pago';
    const code = payment?.codigo ? ` (${payment.codigo})` : '';
    return `${label}${code}`;
  }

  private loadPayments(): void {
    this.paymentsSub = this.paymentsSvc.getAll().subscribe({
      next: (res: any[]) => {
        this.payments = (Array.isArray(res) ? res : []).map((payment: any) => ({
          ...payment,
          name: payment.name || payment.codigo,
          description: payment.description || payment.nombre || payment.name || payment.codigo
        }));
      },
      error: () => {
        this.payments = [];
      }
    });
  }

  private canViewReports(): boolean {
    return this.capabilities.hasPermission('*') || this.capabilities.hasPermission('reports.view');
  }

  private canViewReport(report: ReportDefinition): boolean {
    if (!this.canViewReports()) return false;
    const scope = this.capabilities.reportScope;
    if (scope === 'none' || (scope === 'billing' && report.category !== 'billing')
      || (scope === 'operational' && report.category === 'billing')) return false;
    const features = this.capabilities.features;
    const anyPermission = (...permissions: string[]) => permissions.some(permission => this.capabilities.hasPermission(permission));
    if (report.category === 'restaurant') {
      return features.restaurant === true && anyPermission('restaurant.orders.read', 'restaurant.manage');
    }
    if (report.category === 'products') {
      return features.billing === true && features.products === true && anyPermission('products.read', 'products.manage');
    }
    return features.billing === true && anyPermission('billing.read', 'billing.manage');
  }

  private emptyReport(): ReportDefinition {
    return {
      name: '', title: 'Reportes', description: '', badge: '', accent: '', defaultLimit: 50, category: 'billing', route: '/report',
      visibleColumns: [], filters: []
    };
  }

  private readReportError(error: any, fallback = 'No se pudo cargar el reporte.'): string {
    const status = Number(error?.status || error?.error?.status || 0);
    if (status === 403) return 'No tienes permiso para consultar este reporte.';
    return String(error?.message || error?.error?.message || fallback);
  }

  private buildDefaultFilters(report: ReportDefinition): Record<string, any> {
    const today = String(this.utils.getSoloFechaEcuador());
    const firstDay = `${today.slice(0, 8)}01`;
    const defaults: Record<string, any> = {};

    report.filters.forEach((filter) => {
      if (filter.key === 'from_date') defaults[filter.key] = firstDay;
      else if (filter.key === 'to_date') defaults[filter.key] = today;
      else if (filter.key === 'limit') defaults[filter.key] = report.defaultLimit;
      else defaults[filter.key] = '';
    });

    return defaults;
  }

  private validateFilters(): boolean {
    const missing = this.selectedReport.filters.find((filter) =>
      filter.required && !String(this.filters[filter.key] || '').trim()
    );
    if (missing) {
      toast.error(`Completa el filtro ${missing.label}.`);
      return false;
    }
    if (this.filters['from_date'] && this.filters['to_date'] && this.filters['from_date'] > this.filters['to_date']) {
      toast.error('La fecha desde no puede ser mayor a la fecha hasta.');
      return false;
    }
    if (this.filters['limit'] !== undefined && (!Number.isInteger(Number(this.filters['limit'])) || Number(this.filters['limit']) < 1)) {
      toast.error('El límite debe ser un número entero mayor a cero.');
      return false;
    }
    return true;
  }

  private cleanFilters(filters: Record<string, any>): Record<string, any> {
    return Object.entries(filters || {}).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  private normalizeColumns(columns: Array<FrappeReportColumn | string>): FrappeReportColumn[] {
    return columns.map((column, index) => {
      if (typeof column !== 'string') return { ...column, sourceIndex: index };
      const [labelPart, fieldtypePart] = column.split(':');
      const label = labelPart || `Columna ${index + 1}`;
      return {
        label,
        fieldname: this.normalizeKey(label),
        fieldtype: fieldtypePart || 'Data',
        sourceIndex: index
      };
    });
  }

  private normalizeKey(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private findColumnByKey(key: string): FrappeReportColumn | undefined {
    const wanted = this.normalizeKey(key);
    return this.columns.find((column) =>
      this.normalizeKey(String(column.fieldname || '')) === wanted ||
      this.normalizeKey(String(column.label || '')) === wanted
    );
  }

  private getSourceColumnIndex(column: FrappeReportColumn, fallback: number): number {
    const sourceIndex = Number(column?.['sourceIndex']);
    if (Number.isInteger(sourceIndex) && sourceIndex >= 0) return sourceIndex;
    const foundIndex = this.columns.findIndex((item) =>
      this.normalizeKey(String(item.fieldname || '')) === this.normalizeKey(String(column.fieldname || '')) ||
      this.normalizeKey(String(item.label || '')) === this.normalizeKey(String(column.label || ''))
    );
    return foundIndex >= 0 ? foundIndex : fallback;
  }

  private humanizeKey(value: string): string {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private formatDate(value: any): string {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (!match) return text;
    return `${match[3]}-${match[2]}-${match[1]}${match[4] || ''}`;
  }

  private buildExportFilename(): string {
    const from = String(this.filters['from_date'] || '').trim();
    const to = String(this.filters['to_date'] || '').trim();
    const range = from && to ? `_${from}_${to}` : '';
    return `${this.sanitizeFilename(this.selectedReport.title)}${range}.xlsx`;
  }

  private sanitizeFilename(value: string): string {
    return String(value || 'Reporte')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
