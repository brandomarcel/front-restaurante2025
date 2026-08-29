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

type FilterType = 'date' | 'number' | 'text' | 'select' | 'payment';

interface FilterOption {
  label: string;
  value: string | number;
}

interface ReportFilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  required?: boolean;
  placeholder?: string;
  options?: FilterOption[];
}

interface ReportDefinition {
  name: string;
  title: string;
  description: string;
  badge: string;
  accent: string;
  defaultLimit: number;
  visibleColumns: string[];
  filters: ReportFilterDefinition[];
}

@Component({
  selector: 'app-frappe-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './frappe-reports.component.html'
})
export class FrappeReportsComponent implements OnInit, OnDestroy {
  readonly reports: ReportDefinition[] = [
    {
      name: 'Orders Report',
      title: 'Órdenes',
      description: 'Ventas por orden, estado, tipo de consumo, factura y forma de pago.',
      badge: 'Operación',
      accent: 'from-indigo-500 to-violet-500',
      defaultLimit: 50,
      visibleColumns: [
        'Orden',
        'Fecha',
        'Tipo Orden',
        'Estado Orden',
        'Documento',
        'Factura',
        'Estado SRI',
        'Forma Pago Factura',
        'Total'
      ],
      filters: [
        { key: 'from_date', label: 'Desde', type: 'date', required: true },
        { key: 'to_date', label: 'Hasta', type: 'date', required: true },
        { key: 'estado', label: 'Documento', type: 'select', options: this.options(['Nota Venta', 'Factura']) },
        { key: 'status', label: 'Estado orden', type: 'select', options: this.options(['Ingresada', 'Preparación', 'Cerrada']) },
        { key: 'type_orden', label: 'Tipo orden', type: 'select', options: this.options(['Servirse', 'Llevar', 'Domicilio']) },
        { key: 'payment_method', label: 'Forma de pago', type: 'payment' },
        { key: 'limit', label: 'Límite', type: 'number' }
      ]
    },
    {
      name: 'Productos Más Vendidos',
      title: 'Productos más vendidos',
      description: 'Ranking de productos por cantidad, órdenes, subtotal, IVA y total.',
      badge: 'Productos',
      accent: 'from-emerald-500 to-teal-500',
      defaultLimit: 50,
      visibleColumns: [
        'Producto',
        'Código',
        'Nombre Producto',
        'Categoría',
        'Cantidad Vendida',
        'Órdenes',
        'Total',
        'Última Venta'
      ],
      filters: [
        { key: 'from_date', label: 'Desde', type: 'date', required: true },
        { key: 'to_date', label: 'Hasta', type: 'date', required: true },
        { key: 'estado', label: 'Documento', type: 'select', options: this.options(['Nota Venta', 'Factura']) },
        { key: 'type_orden', label: 'Tipo orden', type: 'select', options: this.options(['Servirse', 'Llevar', 'Domicilio']) },
        { key: 'limit', label: 'Límite', type: 'number' }
      ]
    },
    {
      name: 'Comprobantes Electronicos',
      title: 'Comprobantes electrónicos',
      description: 'Facturas y notas de crédito con estado interno, SRI, plan y clave de acceso.',
      badge: 'SRI',
      accent: 'from-amber-500 to-orange-500',
      defaultLimit: 100,
      visibleColumns: [
        'Tipo',
        'Documento',
        'Fecha Emisión',
        'Total',
        'Estado',
        'Estado SRI',
        'Secuencial'
      ],
      filters: [
        { key: 'from_date', label: 'Desde', type: 'date', required: true },
        { key: 'to_date', label: 'Hasta', type: 'date', required: true },
        { key: 'tipo', label: 'Tipo', type: 'select', options: this.options(['Factura', 'Nota de Credito']) },
        { key: 'status', label: 'Estado', type: 'select', options: this.options(['BORRADOR', 'AUTORIZADO', 'RECHAZADO', 'ERROR', 'ANULADA']) },
        { key: 'einvoice_status', label: 'Estado SRI', type: 'select', options: this.options(['BORRADOR', 'EN COLA', 'FIRMADO', 'ENVIADO', 'AUTORIZADO', 'RECHAZADO', 'ERROR']) },
        { key: 'limit', label: 'Límite', type: 'number' }
      ]
    },
    {
      name: 'Ventas por Forma de Pago',
      title: 'Ventas por forma de pago',
      description: 'Totales cobrados por método interno y código SRI.',
      badge: 'Pagos',
      accent: 'from-sky-500 to-blue-500',
      defaultLimit: 100,
      visibleColumns: [
        'Forma de Pago',
        'Nombre',
        'Código SRI',
        'Facturas',
        'Total Cobrado',
        'Promedio',
        'Última Fecha'
      ],
      filters: [
        { key: 'from_date', label: 'Desde', type: 'date', required: true },
        { key: 'to_date', label: 'Hasta', type: 'date', required: true },
        { key: 'payment_method', label: 'Forma de pago', type: 'payment' },
        { key: 'einvoice_status', label: 'Estado SRI', type: 'select', options: this.options(['AUTORIZADO', 'BORRADOR', 'EN COLA', 'FIRMADO', 'ENVIADO', 'RECHAZADO', 'ERROR']) },
        { key: 'limit', label: 'Límite', type: 'number' }
      ]
    }
  ];

  selectedReportName = this.reports[0].name;
  filters: Record<string, any> = {};
  columns: FrappeReportColumn[] = [];
  rows: any[] = [];
  loading = false;
  exporting = false;
  errorMessage = '';
  payments: any[] = [];

  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private reportSvc: FrappeQueryReportService,
    private paymentsSvc: PaymentsService,
    private utils: UtilsService,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.loadPayments();
    this.routeSub = this.route.data.subscribe((data) => {
      const defaultReport = data?.['defaultReport'];
      this.selectReport(defaultReport || this.selectedReportName, false);
      this.runReport();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get selectedReport(): ReportDefinition {
    return this.reports.find((report) => report.name === this.selectedReportName) || this.reports[0];
  }

  get hasRows(): boolean {
    return this.rows.length > 0;
  }

  get displayColumns(): FrappeReportColumn[] {
    if (!this.columns.length) return [];

    const preferred = this.selectedReport.visibleColumns
      .map((key) => this.findColumnByKey(key))
      .filter((column): column is FrappeReportColumn => !!column);

    return preferred.length ? preferred : this.columns.slice(0, 8);
  }

  selectReport(reportName: string, fetch = true): void {
    const report = this.reports.find((item) => item.name === reportName) || this.reports[0];
    this.selectedReportName = report.name;
    this.filters = this.buildDefaultFilters(report);
    this.columns = [];
    this.rows = [];
    this.errorMessage = '';
    if (fetch) this.runReport();
  }

  runReport(): void {
    if (!this.validateFilters()) return;

    this.loading = true;
    this.errorMessage = '';
    this.spinner.show();

    this.reportSvc.run(this.selectedReport.name, this.cleanFilters(this.filters))
      .pipe(finalize(() => {
        this.loading = false;
        this.spinner.hide();
      }))
      .subscribe({
        next: (response) => {
          const message = response?.message || {};
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
          this.columns = [];
          this.rows = [];
          this.errorMessage = error?.message || 'No se pudo cargar el reporte.';
          toast.error(this.errorMessage);
        }
      });
  }

  clearFilters(): void {
    this.filters = this.buildDefaultFilters(this.selectedReport);
    this.runReport();
  }

  exportExcel(): void {
    if (this.exporting || !this.validateFilters()) return;

    const visibleIndexes = this.getVisibleColumnIndexes();
    if (!visibleIndexes.length) {
      toast.error('Consulta el reporte antes de exportar para identificar las columnas visibles.');
      return;
    }

    this.exporting = true;
    this.spinner.show();

    this.reportSvc.exportExcel(this.selectedReport.name, this.cleanFilters(this.filters), visibleIndexes)
      .pipe(finalize(() => {
        this.exporting = false;
        this.spinner.hide();
      }))
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, this.buildExportFilename());
          toast.success('Reporte exportado correctamente.');
        },
        error: (error) => {
          toast.error(error?.message || 'No se pudo exportar el reporte.');
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
    this.paymentsSvc.getAll().subscribe({
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

  private getVisibleColumnIndexes(): number[] {
    return this.displayColumns
      .map((column, index) => this.getSourceColumnIndex(column, index))
      .filter((index) => Number.isInteger(index) && index >= 0);
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

  private options(values: string[]): FilterOption[] {
    return values.map((value) => ({ label: value, value }));
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
