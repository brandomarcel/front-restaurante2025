import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  Indicator,
  OperationsMetrics,
  RetailStockSummary,
  SignatureStatus,
  TONE_CLASSES
} from '../../dashboard.models';
import { ChartOptions, buildCashFlowChart, buildMoneySummaryChart, buildTopProductsChart } from '../../utils/dashboard-charts';
import {
  OperationsInsights,
  ProductMix,
  averageTicket,
  buildOperationsInsights,
  cashDifferenceIndicator,
  ordersPerHour,
  paceIndicator,
  productMix,
  ticketIndicator,
  unitLabel
} from '../../utils/operations-metrics';

export type CashierExperience = 'Restaurante' | 'Retail' | 'General';

/** Turno de Restaurante o POS genérico: ventas, caja, órdenes y productos. */
@Component({
  selector: 'app-operations-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, NgApexchartsModule],
  templateUrl: './operations-panel.component.html'
})
export class OperationsPanelComponent implements OnChanges {
  @Input() metrics: OperationsMetrics | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Input() needsTerminal = false;
  @Input() showCash = false;
  @Input({ required: true }) signature!: SignatureStatus;
  @Input() cashierExperience: CashierExperience | null = null;
  @Input() retailStock: RetailStockSummary | null = null;

  readonly toneClasses = TONE_CLASSES;
  readonly restaurantStatuses = ['Ingresada', 'Preparacion', 'Lista', 'Cerrada', 'Cancelada'];
  readonly restaurantSaleTypes = ['Servirse', 'Llevar', 'Domicilio'];

  insights: OperationsInsights | null = null;
  ticket = 0;
  ticketStatus: Indicator | null = null;
  pace = 0;
  paceStatus: Indicator | null = null;
  cashStatus: Indicator | null = null;
  mix: ProductMix | null = null;
  unit = 'pedidos';
  topProductsChart: ChartOptions | null = null;
  cashFlowChart: ChartOptions | null = null;
  moneyChart: ChartOptions | null = null;

  ngOnChanges(): void {
    const metrics = this.metrics;
    if (!metrics) {
      this.insights = null;
      return;
    }
    const now = new Date();
    this.unit = unitLabel(metrics.kind);
    this.insights = buildOperationsInsights(metrics, { showCash: this.showCash, signature: this.signature });
    this.ticket = averageTicket(metrics);
    this.ticketStatus = ticketIndicator(metrics);
    this.pace = ordersPerHour(metrics.ordersCount, now);
    this.paceStatus = paceIndicator(metrics, now);
    this.cashStatus = cashDifferenceIndicator(metrics.cash);
    this.mix = productMix(metrics.topProducts);
    this.topProductsChart = buildTopProductsChart(metrics.topProducts);
    this.cashFlowChart = this.showCash ? buildCashFlowChart(metrics.cash, metrics.salesTotal) : null;
    this.moneyChart = this.showCash ? buildMoneySummaryChart(metrics.cash, metrics.salesTotal) : null;
  }

  countFor(map: Record<string, number>, key: string): number {
    return map[key] ?? 0;
  }
}
