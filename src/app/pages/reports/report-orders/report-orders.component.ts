import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersService } from 'src/app/services/orders.service';
import * as FileSaver from 'file-saver';
import { UtilsService } from '../../../core/services/utils.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from "src/app/shared/components/button/button.component";

@Component({
  selector: 'app-report-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './report-orders.component.html',
  styleUrl: './report-orders.component.scss'
})
export class ReportOrdersComponent implements OnInit {
  orders: any[] = [];
  currentPage = 1;
  pageSize = 100;
  hasNextPage = false;
  exportLoading = false;

  filters: any = {
    company: localStorage.getItem('companyId'),
    startDate: this.utilsService.getFechaHoraEcuador().substring(0, 10),
    endDate: this.utilsService.getFechaHoraEcuador().substring(0, 10),
    documentType: '',
  };

  totalItems = 0;
  subtotalGlobal = 0;
  ivaGlobal = 0;
  totalGlobal = 0;

  constructor(
    private orderService: OrdersService,
    public utilsService: UtilsService,
    public spinner: NgxSpinnerService
  ) {}

  ngOnInit() {
    this.fetchOrders();
  }

  get totalPages(): number {
    return this.hasNextPage ? this.currentPage + 1 : this.currentPage;
  }

  get canExport(): boolean {
    return this.totalItems > 0 && !this.exportLoading;
  }

  async fetchOrders() {
    const offset = (this.currentPage - 1) * this.pageSize;
    const reportFilters = this.cleanFilters({
      company: this.filters.company,
      from_date: this.filters.startDate,
      to_date: this.filters.endDate,
      estado: this.filters.documentType || undefined,
      limit: String(this.pageSize),
      offset: String(offset),
    });
    this.spinner.show();

    try {
      const response = await firstValueFrom(
        this.orderService.getOrdersReport(reportFilters)
      );

      const rows = Array.isArray(response?.message?.result) ? response.message.result : [];
      const columns = Array.isArray(response?.message?.columns) ? response.message.columns : [];
      const totalRow = rows.find(
        (row: any) => Array.isArray(row) && String(row?.[0] || '').trim().toLowerCase() === 'total',
      );
      const dataRows = rows.filter((row: any) => !Array.isArray(row));
      const pageRows = dataRows.slice(0, this.pageSize);

      this.orders = pageRows.map((row: any) => ({
        id: row.name,
        customerId: row.cliente,
        customerName: row.nombre_cliente,
        documentType: row.estado || row.type || row.tipo || row.tipo_comprobante || '',
        createdAt: row.creation,
        subtotal: Number.parseFloat(row.subtotal) || 0,
        iva: Number.parseFloat(row.iva) || 0,
        total: Number.parseFloat(row.total) || 0,
      }));

      this.hasNextPage = dataRows.length >= this.pageSize;
      this.calculateSummary(this.orders, totalRow, columns);
    } catch (error: any) {
      console.warn('Error al obtener reporte:', error.message || error);
      this.orders = [];
      this.hasNextPage = false;
      this.calculateSummary([]);
    }

    this.spinner.hide();
  }


  applyFilters() {
    this.currentPage = 1;
    this.fetchOrders();
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.fetchOrders();
  }

  nextPage(): void {
    if (!this.hasNextPage) return;
    this.currentPage += 1;
    this.fetchOrders();
  }

  prevPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
    this.fetchOrders();
  }

  calculateSummary(orders: any[], totalRow?: any[], columns: any[] = []) {
    this.totalItems = orders.length;

    if (Array.isArray(totalRow)) {
      const subtotalIndex = this.getColumnIndex(columns, 'subtotal', 5);
      const ivaIndex = this.getColumnIndex(columns, 'iva', 6);
      const totalIndex = this.getColumnIndex(columns, 'total', 7);

      this.subtotalGlobal = this.toNumber(totalRow[subtotalIndex]);
      this.ivaGlobal = this.toNumber(totalRow[ivaIndex]);
      this.totalGlobal = this.toNumber(totalRow[totalIndex]);
      return;
    }

    this.subtotalGlobal = orders.reduce((sum, o) => sum + this.toNumber(o.subtotal), 0);
    this.ivaGlobal = orders.reduce((sum, o) => sum + this.toNumber(o.iva), 0);
    this.totalGlobal = orders.reduce((sum, o) => sum + this.toNumber(o.total), 0);
  }

  private getColumnIndex(columns: any[], fieldname: string, fallback: number): number {
    const idx = columns.findIndex((col: any) => col?.fieldname === fieldname);
    return idx >= 0 ? idx : fallback;
  }

  private toNumber(value: any): number {
    const num = Number.parseFloat(String(value));
    return Number.isFinite(num) ? num : 0;
  }

  exportToExcel() {
    if (!this.canExport) return;
    this.exportFromBackend();
  }

  private async exportFromBackend() {
    const exportFilters = this.cleanFilters({
      company: this.filters.company,
      from_date: this.filters.startDate,
      to_date: this.filters.endDate,
      estado: this.filters.documentType || undefined,
      limit: '500',
    });

    this.exportLoading = true;
    this.spinner.show();
    try {
      const file = await firstValueFrom(this.orderService.exportOrdersReportExcel(exportFilters));
      const filename = `orders_report_${this.filters.startDate}_${this.filters.endDate}.xlsx`;
      FileSaver.saveAs(file, filename);
    } catch (error: any) {
      console.warn('Error al exportar reporte:', error.message || error);
      alert(error?.message || 'No se pudo exportar el reporte.');
    }
    this.spinner.hide();
    this.exportLoading = false;
  }

  cleanFilters(filters: any): any {
    const cleaned: any = {};
    for (const key in filters) {
      const value = filters[key];
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(typeof value === 'number' && isNaN(value))
      ) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
