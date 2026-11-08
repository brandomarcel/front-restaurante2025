import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';
import {
  KITCHEN_NEXT_ACTION, ORDER_STAGE_BADGE, ORDER_STAGE_LABEL, OrderStage, isInvoiced, kitchenStage, orderHeadline,
  orderStage, orderTypeLabel
} from '../order-status.utils';

/** Vistazo rápido a una orden desde Caja o Cocina; en Cocina se ocultan precios y datos de facturación. */
@Component({
  selector: 'app-order-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-modal.component.html',
  styles: [`
    .modal-btn {
      display: inline-flex; align-items: center; justify-content: center;
      height: 2.5rem; padding: 0 1rem; border-radius: 0.75rem;
      font-size: 0.875rem; font-weight: 700; transition: background-color .15s;
    }
    .modal-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  `]
})
export class OrderModalComponent {

  @Input({ required: true }) order!: OrderVM;
  @Input() allowActions = true;
  @Input() kitchenMode = false;
  @Input() kitchenEnabled = true;
  @Input() showGoOrder = true;
  @Input() actionPending = false;

  @Output() close = new EventEmitter<void>();
  @Output() goOrder = new EventEmitter<OrderVM>();
  @Output() print = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toLista = new EventEmitter<OrderVM>();
  @Output() toEntregado = new EventEmitter<OrderVM>();

  readonly stageLabel = ORDER_STAGE_LABEL;
  readonly stageBadge = ORDER_STAGE_BADGE;

  get stage(): OrderStage {
    return orderStage(this.order?.status);
  }

  get headline(): string {
    return orderHeadline(this.order);
  }

  get typeLabel(): string {
    return orderTypeLabel(this.order);
  }

  get invoiced(): boolean {
    // Una orden cancelada tampoco se cobra: se abre para consultarla.
    return isInvoiced(this.order) || this.stage === 'cancelled';
  }

  get customerName(): string {
    return this.order.customer?.nombre || 'Consumidor final';
  }

  /** Avanzar en cocina desde aquí: orden abierta, con cocina y permiso. */
  get canAdvance(): boolean {
    return this.allowActions && this.kitchenEnabled && ['new', 'prep', 'ready'].includes(this.stage);
  }

  get nextAction(): string {
    return KITCHEN_NEXT_ACTION[kitchenStage(this.order)];
  }

  emitNext(): void {
    const stage = kitchenStage(this.order);
    if (stage === 'NEW') this.toPreparacion.emit(this.order);
    else if (stage === 'PREP') this.toLista.emit(this.order);
    else this.toEntregado.emit(this.order);
  }

  getItemQty(it: any): number {
    return Number(it?.quantity ?? it?.qty ?? 1);
  }

  getItemName(it: any): string {
    return String(it?.productName ?? it?.item_name ?? it?.product ?? '—');
  }

  getItemNotes(it: any): string {
    return String(it?.notes ?? it?.note ?? '').trim();
  }

  getItemKitchenStatus(it: any): string {
    const status = String(it?.kitchen_status ?? it?.kitchenStatus ?? '').trim();
    return status === 'En preparacion' ? 'En preparación' : status;
  }

  getItemTotal(it: any): number {
    return Number(it?.total ?? (this.getItemQty(it) * (it?.price ?? 0)));
  }

  get sriBadgeClass(): string {
    const value = String(this.order?.sri?.status ?? '').toLowerCase();
    if (!value || value.includes('sin factura')) return 'bg-muted text-muted-foreground';
    if (value.includes('autor')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (value.includes('error') || value.includes('rechaz')) return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  }

  get canGoToOrder(): boolean {
    return !this.kitchenMode && !!String(this.order?.name ?? '').trim();
  }
}
