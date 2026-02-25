import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';

@Component({
  selector: 'app-order-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-modal.component.html'
})
export class OrderModalComponent {

  @Input({ required: true }) order!: OrderVM;
  @Input() allowActions = true;
  @Input() kitchenMode = false;

  @Output() close = new EventEmitter<void>();
  @Output() goOrder = new EventEmitter<OrderVM>();
  @Output() print = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toCerrada = new EventEmitter<OrderVM>();

  get badgeClass(): string {
    if (this.order.status === 'Ingresada') return 'bg-sky-100 text-sky-700';
    if (this.order.status === 'Preparación') return 'bg-amber-100 text-amber-800';
    if (this.order.status === 'Cerrada') return 'bg-emerald-100 text-emerald-800';
    return 'bg-gray-100 text-gray-700';
  }

  get customerName(): string {
    return this.order.customer?.nombre ?? '—';
  }

  getItemQty(it: any): number {
    return Number(it?.quantity ?? it?.qty ?? 1);
  }

  getItemName(it: any): string {
    return String(it?.productName ?? it?.product ?? '—');
  }

  getItemTotal(it: any): number {
    return Number(it?.total ?? (this.getItemQty(it) * (it?.price ?? 0)));
  }

  get sriBadgeClass(): string {
    const value = String(this.order?.sri?.status ?? '').toLowerCase();

    if (!value || value.includes('sin factura')) return 'badge-gray';
    if (value.includes('autor')) return 'badge-green';
    if (value.includes('error') || value.includes('rechaz')) return 'badge-red';

    return 'badge-yellow';
  }

  get canGoToOrderForInvoice(): boolean {
    if (this.kitchenMode) return false;
    if (this.order.status !== 'Cerrada') return false;

    const type = String(this.order?.type ?? '').toLowerCase();
    return type.includes('nota') || type.includes('venta');
  }
}
