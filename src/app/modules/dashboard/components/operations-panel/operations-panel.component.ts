import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OperationsMetrics, TopProduct } from '../../dashboard.models';
import { averageTicket, productShares, soldCount, unitLabel } from '../../utils/operations-metrics';
import { CashTicketComponent } from '../cash-ticket/cash-ticket.component';

/**
 * Etapas de una orden de salón, en el orden en que avanza; colores de la pantalla
 * de cocina (`order-status.utils.ts`). Las etapas con órdenes pendientes se resaltan.
 */
const ORDER_STAGES = [
  { key: 'Ingresada', label: 'Ingresadas', dot: 'bg-info-500', active: 'z-[1] border-info-300 bg-info-50' },
  { key: 'Preparacion', label: 'En preparación', dot: 'bg-warning-500', active: 'z-[1] border-warning-300 bg-warning-50' },
  { key: 'Lista', label: 'Listas', dot: 'bg-success-500', active: 'z-[1] border-success-300 bg-success-50' },
  { key: 'Cerrada', label: 'Cerradas', dot: 'bg-muted-foreground', active: '' }
] as const;

const SALE_TYPES = [
  { key: 'Servirse', label: 'En el local' },
  { key: 'Llevar', label: 'Para llevar' },
  { key: 'Domicilio', label: 'A domicilio' }
] as const;

/** Turno de Restaurante o POS genérico: cifras del día, caja y lo más vendido. */
@Component({
  selector: 'app-operations-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, CashTicketComponent],
  templateUrl: './operations-panel.component.html'
})
export class OperationsPanelComponent implements OnChanges {
  @Input() metrics: OperationsMetrics | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Input() needsTerminal = false;
  @Input() showCash = false;
  /** Puede abrir, retirar y cerrar su caja. */
  @Input() canOperateCash = false;
  /** Puede abrir la pantalla Órdenes. */
  @Input() canSeeOrders = false;

  readonly stages = ORDER_STAGES;
  readonly saleTypes = SALE_TYPES;

  ticket = 0;
  sold = 0;
  unit = 'pedidos';
  products: (TopProduct & { share: number })[] = [];

  ngOnChanges(): void {
    const metrics = this.metrics;
    if (!metrics) return;
    this.unit = unitLabel(metrics.kind);
    this.ticket = averageTicket(metrics);
    this.sold = soldCount(metrics);
    this.products = productShares(metrics.topProducts.slice(0, 5));
  }

  countFor(map: Record<string, number>, key: string): number {
    return map[key] ?? 0;
  }

  /** Porcentaje de la venta del día que aporta cada tipo de pedido. */
  shareOf(amount: number): number {
    return this.metrics?.salesTotal ? (amount / this.metrics.salesTotal) * 100 : 0;
  }

  get cancelled(): number {
    return this.metrics ? this.countFor(this.metrics.ordersByStatus, 'Cancelada') : 0;
  }

  /** POS: notas y facturas directas que ya tienen comprobante electrónico. */
  get invoicedCount(): number {
    if (!this.metrics) return 0;
    return this.countFor(this.metrics.ordersByStatus, 'Facturada') + this.countFor(this.metrics.ordersByStatus, 'Factura directa');
  }

  get hasSaleTypes(): boolean {
    return !!this.metrics && SALE_TYPES.some((type) => this.countFor(this.metrics!.salesByType, type.key) > 0);
  }
}
