import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { InvoiceRow, toInvoiceRows } from '../../utils/invoice-rows';

/**
 * Últimos comprobantes del negocio. El backend devuelve los 5 más recientes
 * sin aplicar el mes elegido.
 */
@Component({
  selector: 'app-recent-invoices',
  standalone: true,
  imports: [CommonModule, RouterModule, ElectronicStatusBadgeComponent],
  template: `
    <section class="rounded-xl border border-border bg-card" aria-labelledby="recent-invoices-title">
      <div class="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <h2 id="recent-invoices-title" class="text-[15px] font-semibold text-foreground">Últimas facturas</h2>
          <p class="text-[13px] text-muted-foreground">{{ subtitle }}</p>
        </div>
        <a *ngIf="canOpen && rows.length" routerLink="/dashboard/invoices" class="shrink-0 text-[13px] font-medium text-primary hover:underline">Ver todas</a>
      </div>

      <p *ngIf="!rows.length" class="px-5 pb-5 text-[13px] text-muted-foreground">
        Todavía no hay facturas. Cuando emitas la primera, aparecerá aquí con su estado en el SRI.
      </p>

      <ul *ngIf="rows.length" class="divide-y divide-border border-t border-border">
        <li *ngFor="let row of rows">
          <a *ngIf="canOpen && row.id; else plainRow" [routerLink]="['/dashboard/invoices', row.id]"
            class="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
            <ng-container *ngTemplateOutlet="rowBody; context: { $implicit: row }"></ng-container>
          </a>
          <ng-template #plainRow>
            <div class="flex items-center gap-4 px-5 py-3">
              <ng-container *ngTemplateOutlet="rowBody; context: { $implicit: row }"></ng-container>
            </div>
          </ng-template>
        </li>
      </ul>
    </section>

    <ng-template #rowBody let-row>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-foreground">{{ row.customer }}</p>
        <p class="truncate text-[12px] text-muted-foreground tabular-nums">{{ row.name }}, {{ row.date }}</p>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1">
        <span class="text-sm font-semibold text-foreground tabular-nums">{{ row.total | currency:'USD':'symbol':'1.2-2' }}</span>
        <app-electronic-status-badge [document]="{ status: row.status }"></app-electronic-status-badge>
      </div>
    </ng-template>
  `
})
export class RecentInvoicesComponent {
  @Input() subtitle = 'Las 5 más recientes, de cualquier mes.';
  /** Puede abrir Facturas (`billing.read`). */
  @Input() canOpen = false;
  rows: InvoiceRow[] = [];

  @Input() set invoices(value: unknown[] | null | undefined) {
    this.rows = toInvoiceRows(value);
  }
}
