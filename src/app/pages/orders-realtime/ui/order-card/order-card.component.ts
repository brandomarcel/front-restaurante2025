import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { OrderVM } from 'src/app/services/realtime-orders.service';
import {
  KITCHEN_NEXT_ACTION, ORDER_STAGE_BADGE, ORDER_STAGE_LABEL, OrderStage, formatMinutes, isInvoiced, kitchenStage,
  orderAgeMinutes, orderHeadline, orderStage, orderTypeLabel, waitTone
} from '../order-status.utils';

/** Versión móvil de una fila de Caja: mismos datos y acción principal que la tabla. */
@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './order-card.component.html'
})
export class OrderCardComponent {

  @Input({ required: true }) order!: OrderVM;
  @Input() allowActions = true;
  @Input() now = Date.now();

  @Output() open = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toLista = new EventEmitter<OrderVM>();
  @Output() toEntregado = new EventEmitter<OrderVM>();
  @Input() actionPending = false;
  @Output() goOrder = new EventEmitter<OrderVM>();
  /** Sin cocina no hay avances de cocina: el pedido se imprime y se cobra. */
  @Input() kitchenEnabled = true;
  @Output() printComanda = new EventEmitter<OrderVM>();

  readonly stageLabel = ORDER_STAGE_LABEL;
  readonly stageBadge = ORDER_STAGE_BADGE;

  get stage(): OrderStage {
    return orderStage(this.order.status);
  }

  get isActive(): boolean {
    return this.stage === 'new' || this.stage === 'prep' || this.stage === 'ready';
  }

  get headline(): string {
    return orderHeadline(this.order);
  }

  get typeLabel(): string {
    return orderTypeLabel(this.order);
  }

  /** Siguiente paso de cocina, con el mismo texto que la pantalla de cocina. */
  get nextAction(): string {
    return KITCHEN_NEXT_ACTION[kitchenStage(this.order)];
  }

  emitNext(): void {
    const stage = kitchenStage(this.order);
    if (stage === 'NEW') this.toPreparacion.emit(this.order);
    else if (stage === 'PREP') this.toLista.emit(this.order);
    else this.toEntregado.emit(this.order);
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
