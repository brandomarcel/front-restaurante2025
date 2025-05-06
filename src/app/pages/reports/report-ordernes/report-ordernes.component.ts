import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersService } from 'src/app/services/orders.service';

@Component({
  selector: 'app-report-ordernes',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-ordernes.component.html',
  styleUrl: './report-ordernes.component.css'
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
    startDate: '',
    endDate: '',
    limit: 10,
    offset: 0,
  };

  constructor(private orderService: OrdersService) { }

  ngOnInit() {
    this.fetchOrders();
  }

  fetchOrders() {
    const cleanedFilters = this.cleanFilters(this.filters);
    this.orderService.getFilteredOrders(cleanedFilters).subscribe((res) => {
      this.orders = res.data;
      this.calculateSummary(this.orders);

      this.total = res.total;
      this.totalPages = Math.ceil(res.total / this.filters.limit);
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

}