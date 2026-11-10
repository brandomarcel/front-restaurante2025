import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LiteDashboardSales } from 'src/app/services/facturada-lite-dashboard.service';

/**
 * Comprobantes del mes elegido (`get_dashboard` de Lite). «Facturado» y
 * «Cobrado» cuentan solo facturas autorizadas o emitidas; los estados se
 * cuentan aparte y los que piden acción llevan a la lista de Facturas.
 */
@Component({
  selector: 'app-billing-kpis',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="grid grid-cols-2 overflow-hidden border-t border-border sm:grid-cols-3 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr]">
      <div class="col-span-2 border-b border-border bg-primary/[0.06] px-5 py-4 sm:col-span-3 lg:col-span-1 lg:border-b-0">
        <p class="text-[13px] font-medium text-primary">Facturado</p>
        <p class="mt-1 text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {{ sales.sales_total | currency:'USD':'symbol':'1.2-2' }}
        </p>
        <p class="mt-2 text-[12px] text-muted-foreground">Autorizadas y emitidas</p>
      </div>

      <div class="col-span-2 border-b border-border px-5 py-4 sm:col-span-3 lg:col-span-1 lg:border-b-0 lg:border-l">
        <p class="text-[13px] text-muted-foreground">Cobrado</p>
        <p class="mt-1 text-[22px] font-semibold leading-tight text-foreground tabular-nums">
          {{ sales.collected_total | currency:'USD':'symbol':'1.2-2' }}
        </p>
        <p class="mt-1 text-[12px] text-muted-foreground">Pagos registrados</p>
      </div>

      <div class="px-5 py-4 lg:border-l lg:border-border">
        <p class="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span class="h-2 w-2 rounded-full bg-success-500" aria-hidden="true"></span>Autorizadas
        </p>
        <p class="mt-1 text-[22px] font-semibold leading-tight text-foreground tabular-nums">{{ sales.authorized_count }}</p>
        <p class="mt-1 text-[12px] text-muted-foreground">De {{ sales.invoice_count }} {{ sales.invoice_count === 1 ? 'factura' : 'facturas' }}</p>
      </div>

      <div class="border-l border-border px-5 py-4">
        <p class="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span class="h-2 w-2 rounded-full bg-info-500" aria-hidden="true"></span>En proceso
        </p>
        <p class="mt-1 text-[22px] font-semibold leading-tight tabular-nums"
          [ngClass]="sales.pending_count ? 'text-info-700' : 'text-muted-foreground/60'">{{ sales.pending_count }}</p>
        <p class="mt-1 text-[12px] text-muted-foreground">Aún sin autorizar</p>
      </div>

      <div class="col-span-2 border-t border-border px-5 py-4 sm:col-span-1 sm:border-l sm:border-t-0">
        <p class="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span class="h-2 w-2 rounded-full bg-danger-500" aria-hidden="true"></span>Rechazadas
        </p>
        <p class="mt-1 text-[22px] font-semibold leading-tight tabular-nums"
          [ngClass]="sales.rejected_count ? 'text-danger-700' : 'text-muted-foreground/60'">{{ sales.rejected_count }}</p>
        <a *ngIf="sales.rejected_count && canSeeInvoices; else rejectedHint" routerLink="/dashboard/invoices" [queryParams]="{ estado: 'Rechazada' }"
          class="mt-1 inline-block text-[12px] font-medium text-primary hover:underline">Ver y corregir</a>
        <ng-template #rejectedHint><p class="mt-1 text-[12px] text-muted-foreground">Por el SRI</p></ng-template>
      </div>
    </div>
  `
})
export class BillingKpisComponent {
  @Input({ required: true }) sales!: LiteDashboardSales;
  @Input() canSeeInvoices = false;
}
