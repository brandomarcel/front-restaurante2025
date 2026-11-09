import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { OrderVM } from 'src/app/services/realtime-orders.service';
import {
  KITCHEN_NEXT_ACTION, ORDER_STAGE_BADGE, ORDER_STAGE_LABEL, OrderStage, formatMinutes, isInvoiced, kitchenStage,
  orderAgeMinutes, orderHeadline, orderStage, orderTypeLabel, waitTone
} from '../order-status.utils';

@Component({
  selector: 'app-order-table',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './order-table.component.html',
  styleUrl: './order-table.component.css'
})
export class OrderTableComponent {

  @Input() orders: OrderVM[] = [];
  @Input() allowActions = true;
  /** Reloj compartido del padre para el tiempo de espera (evita un timer por fila). */
  @Input() now = Date.now();

  @Output() open = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toLista = new EventEmitter<OrderVM>();
  @Output() toEntregado = new EventEmitter<OrderVM>();
  /** Pedidos con un avance de cocina en curso. */
  @Input() pendingOrderNames: string[] = [];
  @Output() goOrder = new EventEmitter<OrderVM>();
  /** Sin cocina no hay avances de cocina: el pedido se imprime y se cobra. */
  @Input() kitchenEnabled = true;
  @Output() printComanda = new EventEmitter<OrderVM>();

  readonly stageLabel = ORDER_STAGE_LABEL;
  readonly stageBadge = ORDER_STAGE_BADGE;
  readonly invoiced = isInvoiced;
  readonly headline = orderHeadline;
  readonly typeLabel = orderTypeLabel;

  trackByName = (_: number, o: OrderVM) => o.name;

  stage(o: OrderVM): OrderStage {
    return orderStage(o.status);
  }

  /** Solo las órdenes en curso muestran espera; las cerradas muestran la hora. */
  isActive(o: OrderVM): boolean {
    const stage = this.stage(o);
    return stage === 'new' || stage === 'prep' || stage === 'ready';
  }

  /** Siguiente paso de cocina, con el mismo texto que la pantalla de cocina. */
  nextAction(o: OrderVM): string {
    return KITCHEN_NEXT_ACTION[kitchenStage(o)];
  }

  emitNext(o: OrderVM): void {
    const stage = kitchenStage(o);
    if (stage === 'NEW') this.toPreparacion.emit(o);
    else if (stage === 'PREP') this.toLista.emit(o);
    else this.toEntregado.emit(o);
  }

  isPending(o: OrderVM): boolean {
    return this.pendingOrderNames.includes(o.name);
  }

  wait(o: OrderVM): string {
    return formatMinutes(orderAgeMinutes(o, this.now));
  }

  waitClass(o: OrderVM): string {
    switch (waitTone(orderAgeMinutes(o, this.now))) {
      case 'late': return 'text-danger-600 ';
      case 'warn': return 'text-warning-600 ';
      default: return 'text-muted-foreground';
    }
  }

  getSriBadge(status?: string): string {
    const value = String(status ?? '').toLowerCase();
    if (!value || value.includes('sin factura')) return 'bg-muted text-muted-foreground';
    if (value.includes('autor')) return 'bg-success-500/15 text-success-700 ';
    if (value.includes('error') || value.includes('rechaz')) return 'bg-danger-500/15 text-danger-700 ';
    return 'bg-warning-500/15 text-warning-700 ';
  }
}
