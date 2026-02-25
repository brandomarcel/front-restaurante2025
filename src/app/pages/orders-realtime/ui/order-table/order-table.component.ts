import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';

@Component({
  selector: 'app-order-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-table.component.html'
})
export class OrderTableComponent {

  @Input() orders: OrderVM[] = [];
  @Input() allowActions = true;

  @Output() open = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toCerrada = new EventEmitter<OrderVM>();

  trackByName = (_: number, o: OrderVM) => o.name;

  getBadgeClass(status: string) {
    switch (status) {
      case 'Ingresada':
        return 'bg-sky-100 text-sky-700';
      case 'Preparación':
        return 'bg-amber-100 text-amber-700';
      case 'Cerrada':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getRowClass(status: string) {
    switch (status) {
      case 'Ingresada':
        return 'bg-sky-50';
      case 'Preparación':
        return 'bg-amber-50';
      case 'Cerrada':
        return 'bg-emerald-50';
      default:
        return '';
    }
  }

  getSriBadge(status?: string): string {
    const value = String(status ?? '').toLowerCase();

    if (!value || value.includes('sin factura')) return 'badge-gray';
    if (value.includes('autor')) return 'badge-green';
    if (value.includes('error') || value.includes('rechaz')) return 'badge-red';

    return 'badge-yellow';
  }
}
