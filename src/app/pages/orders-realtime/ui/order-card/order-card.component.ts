import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';
import {
  ORDER_STAGE_BADGE, ORDER_STAGE_LABEL, OrderStage, formatMinutes, isInvoiced, orderAgeMinutes, orderStage, tableLabel, waitTone
} from '../order-status.utils';

/** Versión móvil de una fila de Caja: mismos datos y acción principal que la tabla. */
@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-card.component.html'
})
export class OrderCardComponent {

  @Input({ required: true }) order!: OrderVM;
  @Input() allowActions = true;
  @Input() now = Date.now();

  @Output() open = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toCerrada = new EventEmitter<OrderVM>();
  @Output() goOrder = new EventEmitter<OrderVM>();
  @Output() printComanda = new EventEmitter<OrderVM>();

  readonly stageLabel = ORDER_STAGE_LABEL;
  readonly stageBadge = ORDER_STAGE_BADGE;

  get stage(): OrderStage {
    return orderStage(this.order.status);
  }

  get isActive(): boolean {
    return this.stage === 'new' || this.stage === 'prep' || this.stage === 'ready';
  }

  get table(): string {
    return tableLabel(this.order);
  }

  get invoiced(): boolean {
    return isInvoiced(this.order);
  }

  get wait(): string {
    return formatMinutes(orderAgeMinutes(this.order, this.now));
  }

  get waitClass(): string {
    switch (waitTone(orderAgeMinutes(this.order, this.now))) {
      case 'late': return 'text-rose-600 dark:text-rose-400';
      case 'warn': return 'text-amber-600 dark:text-amber-400';
      default: return 'text-muted-foreground';
    }
  }
}
