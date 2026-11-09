import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiteDashboardSales } from 'src/app/services/facturada-lite-dashboard.service';

/** Indicadores de comprobantes del periodo (`get_dashboard` de Lite). */
@Component({
  selector: 'app-billing-kpis',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      <article class="rounded-xl border border-border bg-card p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total vendido</p>
        <p class="mt-1 text-lg font-black text-primary">{{ sales.sales_total | currency:'USD':'symbol':'1.2-2' }}</p>
        <p class="text-[10px] text-muted-foreground">{{ sales.invoice_count }} facturas</p>
      </article>
      <article class="rounded-xl border border-border bg-card p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pago declarado</p>
        <p class="mt-1 text-lg font-black text-success-600">{{ sales.collected_total | currency:'USD':'symbol':'1.2-2' }}</p>
        <p class="text-[10px] text-muted-foreground">Formas de pago de las facturas</p>
      </article>
      <article class="rounded-xl border border-success-200 bg-success-50 p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-success-700">Autorizadas</p>
        <p class="mt-1 text-lg font-black text-success-800">{{ sales.authorized_count }}</p>
        <p class="text-[10px] text-success-700">Aceptadas por el SRI</p>
      </article>
      <article class="rounded-xl border border-info-200 bg-info-50 p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-info-700">En proceso</p>
        <p class="mt-1 text-lg font-black text-info-800">{{ sales.pending_count }}</p>
        <p class="text-[10px] text-info-700">Pendientes de autorización</p>
      </article>
      <article class="rounded-xl border border-danger-200 bg-danger-50 p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-danger-700">Rechazadas</p>
        <p class="mt-1 text-lg font-black text-danger-800">{{ sales.rejected_count }}</p>
        <p class="text-[10px] text-danger-700">Requieren revisión</p>
      </article>
    </section>
  `
})
export class BillingKpisComponent {
  @Input({ required: true }) sales!: LiteDashboardSales;
}
