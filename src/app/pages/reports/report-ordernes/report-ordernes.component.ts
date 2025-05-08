import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersService } from 'src/app/services/orders.service';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { UtilsService } from '../../../core/services/utils.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-report-ordernes',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-ordernes.component.html',
  styleUrl: './report-ordernes.component.scss'
})
export class ReportOrdernesComponent implements OnInit {
  orders: any[] = [];
  total = 0;
  currentPage = 1;
  totalPages = 1;

  filters: any = {
    itemName: '',
    status: '',
    type: '',
    customerId: null,
    startDate: this.utilsService.getFechaEcuador(),
    endDate: this.utilsService.getFechaEcuador(),
    limit: 10,
    offset: 0,
  };
  

  constructor(private orderService: OrdersService,
    public utilsService:UtilsService,
    public spinner: NgxSpinnerService
  ) { }

  ngOnInit() {
    console.log('ngOnInit',this.utilsService.getFechaEcuador());
    this.fetchOrders();
  }
  fetchOrders() {
    const cleanedFilters = this.cleanFilters(this.filters);
    this.spinner.show();
    this.orderService.getFilteredOrders(cleanedFilters).subscribe( {
      next: (res) => {
        this.orders = res.data;
        this.calculateSummary(this.orders);
        this.total = res.total;
        this.totalPages = Math.ceil(res.total / this.filters.limit);
        this.spinner.hide();
      },
      error: (err) => {
        this.spinner.hide();
        console.log(err);
      },
    });
  }
     

  applyFilters() {
    this.filters.offset = 0;
    this.currentPage = 1;
    this.fetchOrders();
  }

  nextPage() {
    if (this.filters.offset + this.filters.limit < this.total) {
      this.filters.offset += this.filters.limit;
      this.currentPage++;
      this.fetchOrders();
    }
  }

  prevPage() {
    if (this.filters.offset >= this.filters.limit) {
      this.filters.offset -= this.filters.limit;
      this.currentPage--;
      this.fetchOrders();
    }
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

  totalItems = 0;
  subtotalGlobal = 0;
  ivaGlobal = 0;
  totalGlobal = 0;

  calculateSummary(orders: any[]) {
    this.totalItems = 0;
    this.subtotalGlobal = 0;
    this.ivaGlobal = 0;
    this.totalGlobal = 0;

    for (const order of orders) {
      this.totalItems += order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      this.subtotalGlobal += parseFloat(order.subtotal);
      this.ivaGlobal += parseFloat(order.iva);
      this.totalGlobal += parseFloat(order.total);
    }
  }


  exportToExcel() {

    if (this.orders.length === 0) {
      alert('No hay datos para exportar a Excel.');
      return;
      
    }
    const worksheetData: any[] = [];
  
    // Encabezados manuales
    worksheetData.push([
      'ID', 'Cliente', 'Fecha', 'Estado', 'Tipo', 'Items', 'Subtotal', 'IVA', 'Total'
    ]);
  
    for (const order of this.orders) {
      const itemSummary = order.items.map((i: any) => `${i.productName} (x${i.quantity})`).join(', ');
  
      worksheetData.push([
        order.id,
        order.customer.fullName,
        new Date(order.createdAt).toLocaleString(),
        order.status,
        order.type,
        itemSummary,
        parseFloat(order.subtotal),
        parseFloat(order.iva),
        parseFloat(order.total),
      ]);
    }
  
    // Fila vacía
    worksheetData.push([]);
  
    // Resumen global
    worksheetData.push(['Resumen']);
    worksheetData.push([
      'Total productos vendidos',
      this.totalItems,
      '',
      '',
      '',
      '',
      'Subtotal',
      'IVA',
      'Total'
    ]);
    worksheetData.push([
      '',
      '',
      '',
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
  

}