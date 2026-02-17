import { Component, EventEmitter, Input, Output, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';

@Component({
  selector: 'app-order-kitchen-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-kitchen-card.component.html'
})
export class OrderKitchenCardComponent implements OnInit, OnDestroy {

  @Input({ required: true }) order!: OrderVM;

  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toCerrada = new EventEmitter<OrderVM>();

  // minutos transcurridos (se refresca solo)
  minutes = 0;
  private timer: any;

  ngOnInit(): void {
    this.updateMinutes();
    this.timer = setInterval(() => this.updateMinutes(), 15_000); // cada 15s
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private updateMinutes() {
    const d = this.order.createdAtISO || this.order.createdAt;
    if (!d) { this.minutes = 0; return; }
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) { this.minutes = 0; return; }
    const diff = Date.now() - t;
    this.minutes = Math.max(0, Math.floor(diff / 60000));
  }

  badgeClass(): string {
    if (this.order.status === 'Ingresada') return 'bg-rose-100 text-rose-700';
    if (this.order.status === 'Preparación') return 'bg-amber-100 text-amber-800';
    if (this.order.status === 'Cerrada') return 'bg-emerald-100 text-emerald-800';
    return 'bg-gray-100 text-gray-700';
  }

  borderClass(): string {
    if (this.order.status === 'Ingresada') return 'border-rose-300 bg-rose-50';
    if (this.order.status === 'Preparación') return 'border-amber-300 bg-amber-50';
    if (this.order.status === 'Cerrada') return 'border-emerald-300 bg-emerald-50';
    return 'border-gray-200 bg-white';
  }

  urgencyText(): string {
    // puedes ajustar thresholds
    if (this.minutes >= 20) return '🔥 URGENTE';
    if (this.minutes >= 10) return '⏱️ EN COLA';
    return '🟢 OK';
  }

  urgencyClass(): string {
    if (this.minutes >= 20) return 'text-rose-700';
    if (this.minutes >= 10) return 'text-amber-700';
    return 'text-emerald-700';
  }

  // fallback por si el socket manda items con qty/rate/product
  getItemQty(it: any): number {
    return Number(it?.quantity ?? it?.qty ?? 1);
  }

  getItemName(it: any): string {
    return String(it?.productName ?? it?.product ?? '—');
  }
}
