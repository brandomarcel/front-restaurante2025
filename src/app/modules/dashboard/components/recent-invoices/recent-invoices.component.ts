import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvoiceRow, toInvoiceRows } from '../../utils/invoice-rows';

/**
 * Últimos comprobantes del negocio. El backend devuelve los 5 más recientes
 * sin aplicar el periodo filtrado.
 */
@Component({
  selector: 'app-recent-invoices',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div class="mb-2">
        <h2 class="text-sm font-bold text-foreground">Últimos comprobantes</h2>
        <p class="text-[10px] text-muted-foreground">{{ subtitle }}</p>
      </div>
      <div *ngIf="!rows.length" class="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
        Todavía no hay comprobantes emitidos.
      </div>
      <div *ngIf="rows.length" class="overflow-x-auto">
        <table class="w-full min-w-[620px] text-left text-[11px]">
          <thead class="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th class="px-2 py-2">Documento</th>
              <th class="px-2 py-2">Fecha</th>
              <th class="px-2 py-2">Cliente</th>
              <th class="px-2 py-2">Estado</th>
              <th class="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows" class="border-b border-border last:border-0">
              <td class="px-2 py-2 font-bold text-primary">{{ row.name }}</td>
              <td class="px-2 py-2 text-muted-foreground">{{ row.date }}</td>
              <td class="max-w-[180px] truncate px-2 py-2 text-foreground/80">{{ row.customer }}</td>
              <td class="px-2 py-2"><span class="rounded-md bg-muted px-2 py-1 font-semibold text-foreground/80">{{ row.status }}</span></td>
              <td class="px-2 py-2 text-right font-black text-foreground">{{ row.total | currency:'USD':'symbol':'1.2-2' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class RecentInvoicesComponent {
  @Input() subtitle = 'Los 5 comprobantes más recientes del negocio.';
  rows: InvoiceRow[] = [];

  @Input() set invoices(value: unknown[] | null | undefined) {
    this.rows = toInvoiceRows(value);
  }
}
