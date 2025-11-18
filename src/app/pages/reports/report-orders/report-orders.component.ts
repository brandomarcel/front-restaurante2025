import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersService } from 'src/app/services/orders.service';
import * as XLSX from 'xlsx';
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
  total = 0;
  currentPage = 1;
  totalPages = 1;

  filters: any = {
    company: localStorage.getItem('companyId'),
    startDate: this.utilsService.getFechaHoraEcuador().substring(0, 10),
    endDate: this.utilsService.getFechaHoraEcuador().substring(0, 10),
    limit: 100,
    offset: 0,
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

  async fetchOrders() {
  const { startDate, endDate,company, limit, offset} = this.filters;
  this.spinner.show();

  try {
    const response = await firstValueFrom(
      this.orderService.getOrdersReport(company, startDate, endDate, limit, offset)
    );

    const rows = response.message?.result || [];
    console.log('rows', rows);

    this.orders = rows.map((row: any) => ({
      id: row.name,
      customerId: row.cliente,
      customerName: row.nombre_cliente,
      createdAt: row.creation,
      subtotal: parseFloat(row.subtotal),
      iva: parseFloat(row.iva),
      total: parseFloat(row.total),
    }));

    this.calculateSummary(this.orders);
    this.total = this.orders.length;
    this.totalPages = 1;

  } catch (error: any) {
    console.warn('Error al obtener reporte:', error.message || error);
  }

  this.spinner.hide();
}


  applyFilters() {
    this.filters.offset = 0;
    this.currentPage = 1;
    this.fetchOrders();
  }

  calculateSummary(orders: any[]) {
    this.totalItems = orders.length;
    this.subtotalGlobal = orders.reduce((sum, o) => sum + o.subtotal, 0);
    this.ivaGlobal = orders.reduce((sum, o) => sum + o.iva, 0);
    this.totalGlobal = orders.reduce((sum, o) => sum + o.total, 0);
  }

  exportToExcel() {
    if (this.orders.length === 0) {
      alert('No hay datos para exportar a Excel.');
      return;
    }

    const worksheetData: any[] = [];

    worksheetData.push([
      'ID',
      'Cliente',
      'Fecha',
      'Subtotal',
      'IVA',
      'Total'
    ]);

    for (const order of this.orders) {
      worksheetData.push([
        order.id,
        order.customerName,
        new Date(order.createdAt).toLocaleString(),
        order.subtotal,
        order.iva,
        order.total
      ]);
    }

    worksheetData.push([]);
    worksheetData.push(['Resumen']);
    worksheetData.push([
      'Total órdenes',
      this.totalItems,
      '',
      'Subtotal',
      'IVA',
      'Total'
    ]);
    worksheetData.push([
      '',
      '',
      '',
      this.subtotalGlobal,
      this.ivaGlobal,
      this.totalGlobal
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Órdenes');

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const data: Blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    FileSaver.saveAs(data, 'ordenes.xlsx');
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
