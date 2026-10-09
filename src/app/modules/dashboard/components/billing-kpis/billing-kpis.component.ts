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
        <p class="mt-1 text-lg font-black text-emerald-600">{{ sales.collected_total | currency:'USD':'symbol':'1.2-2' }}</p>
        <p class="text-[10px] text-muted-foreground">Formas de pago de las facturas</p>
      </article>
      <article class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Autorizadas</p>
        <p class="mt-1 text-lg font-black text-emerald-800">{{ sales.authorized_count }}</p>
        <p class="text-[10px] text-emerald-700">Aceptadas por el SRI</p>
      </article>
      <article class="rounded-xl border border-sky-200 bg-sky-50 p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-sky-700">En proceso</p>
        <p class="mt-1 text-lg font-black text-sky-800">{{ sales.pending_count }}</p>
        <p class="text-[10px] text-sky-700">Pendientes de autorización</p>
      </article>
      <article class="rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wide text-red-700">Rechazadas</p>
        <p class="mt-1 text-lg font-black text-red-800">{{ sales.rejected_count }}</p>
        <p class="text-[10px] text-red-700">Requieren revisión</p>
      </article>
    </section>
  `
})
export class BillingKpisComponent {
  @Input({ required: true }) sales!: LiteDashboardSales;
}
