import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LiteDashboard } from 'src/app/services/facturada-lite-dashboard.service';
import { PlanSummary } from '../../dashboard.models';
import { planWarning } from '../../utils/plan-summary';
import { BillingKpisComponent } from '../billing-kpis/billing-kpis.component';
import { RecentInvoicesComponent } from '../recent-invoices/recent-invoices.component';

/** Negocio de solo facturación: comprobantes, plan e inventario. */
@Component({
  selector: 'app-billing-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, BillingKpisComponent, RecentInvoicesComponent],
  template: `
    <app-billing-kpis [sales]="dashboard.sales"></app-billing-kpis>

    <section *ngIf="warning" class="mb-3 rounded-xl border p-3 text-xs font-semibold"
      [ngClass]="!plan ? 'border-border bg-muted/40 text-foreground/80' : 'border-amber-200 bg-amber-50 text-amber-800'">
      {{ warning }}
    </section>

    <section *ngIf="inventoryEnabled && dashboard.inventory.low_stock_items > 0" class="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-rose-800">Alerta de inventario</h2>
          <p class="text-[11px] text-rose-700">{{ dashboard.inventory.low_stock_items }} producto(s) en o bajo el stock mínimo.</p>
        </div>
        <a routerLink="/dashboard/inventory" class="rounded-md bg-rose-600 px-2.5 py-1.5 text-[10px] font-bold text-white">Revisar inventario</a>
      </div>
      <div class="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        <div *ngFor="let item of dashboard.inventory.out_of_stock_items" class="rounded-lg border border-rose-200 bg-card px-2.5 py-2 text-[11px] text-foreground/80">
          <p class="font-bold text-foreground">{{ item.item_name || item.item_code || item.name }}</p>
          <p class="text-rose-700">Stock actual · {{ item.current_stock || 0 }}</p>
        </div>
      </div>
    </section>

    <app-recent-invoices [invoices]="dashboard.recent_invoices"></app-recent-invoices>
  `
})
export class BillingPanelComponent {
  @Input({ required: true }) dashboard!: LiteDashboard;
  @Input() plan: PlanSummary | null = null;
  @Input() inventoryEnabled = false;

  get warning(): string | null {
    return planWarning(this.plan);
  }
}
