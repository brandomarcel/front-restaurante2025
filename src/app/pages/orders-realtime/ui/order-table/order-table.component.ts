import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';
import {
  ORDER_STAGE_BADGE, ORDER_STAGE_LABEL, OrderStage, formatMinutes, isInvoiced, orderAgeMinutes, orderStage, tableLabel, waitTone
} from '../order-status.utils';

@Component({
  selector: 'app-order-table',
  standalone: true,
  imports: [CommonModule],
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
  @Output() toCerrada = new EventEmitter<OrderVM>();
  @Output() goOrder = new EventEmitter<OrderVM>();
  /** Sin cocina no hay a quién «enviar»: en vez de eso el pedido nuevo se imprime y se cobra. */
  @Input() kitchenEnabled = true;
  @Output() printComanda = new EventEmitter<OrderVM>();

  readonly stageLabel = ORDER_STAGE_LABEL;
  readonly stageBadge = ORDER_STAGE_BADGE;
  readonly table = tableLabel;
  readonly invoiced = isInvoiced;

  trackByName = (_: number, o: OrderVM) => o.name;

  stage(o: OrderVM): OrderStage {
    return orderStage(o.status);
  }

  /** Solo las órdenes en curso muestran espera; las cerradas muestran la hora. */
  isActive(o: OrderVM): boolean {
    const stage = this.stage(o);
    return stage === 'new' || stage === 'prep' || stage === 'ready';
  }

  wait(o: OrderVM): string {
    return formatMinutes(orderAgeMinutes(o, this.now));
  }

  waitClass(o: OrderVM): string {
    switch (waitTone(orderAgeMinutes(o, this.now))) {
      case 'late': return 'text-rose-600 dark:text-rose-400';
      case 'warn': return 'text-amber-600 dark:text-amber-400';
      default: return 'text-muted-foreground';
    }
  }

  getSriBadge(status?: string): string {
    const value = String(status ?? '').toLowerCase();
    if (!value || value.includes('sin factura')) return 'bg-muted text-muted-foreground';
    if (value.includes('autor')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (value.includes('error') || value.includes('rechaz')) return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  }
}
