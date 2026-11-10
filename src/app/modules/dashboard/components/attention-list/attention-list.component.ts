import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AttentionItem } from '../../dashboard.models';

const TONES: Record<AttentionItem['tone'], { icon: string; label: string }> = {
  danger: { icon: 'bg-danger-100 text-danger-700', label: 'Urgente' },
  warning: { icon: 'bg-warning-100 text-warning-700', label: 'Importante' },
  info: { icon: 'bg-info-100 text-info-700', label: 'Para revisar' }
};

/** Ícono por tema del aviso (trazos de 24×24), para reconocerlo sin leer. */
const ICONS: Record<string, string> = {
  signature: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  plan: 'M3 6h18v12H3zM3 10h18M7 15h4',
  rejected: 'M14 3H6v18h12V7zM14 3v4h4M10 12l4 4M14 12l-4 4',
  pending: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 10v4M18 10v4',
  stock: 'M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8',
  'billing-error': 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01'
};

/**
 * «Necesita tu atención»: lo que bloquea o pronto bloqueará el trabajo, cada
 * punto con el botón que lo resuelve. Sin pendientes, una línea tranquila.
 */
@Component({
  selector: 'app-attention-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section *ngIf="items.length; else allClear" class="mb-5 overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="attention-title">
      <h2 id="attention-title" class="border-b border-border px-4 py-3 text-[15px] font-semibold text-foreground sm:px-5">
        Necesita tu atención
        <span class="ml-1 font-normal text-muted-foreground">({{ items.length }})</span>
      </h2>
      <ul class="divide-y divide-border">
        <li *ngFor="let item of items; trackBy: trackById" class="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full" [ngClass]="tones[item.tone].icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path [attr.d]="icons[item.id] || icons['billing-error']" />
            </svg>
          </span>
          <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">
                <span class="sr-only">{{ tones[item.tone].label }}: </span>{{ item.title }}
              </p>
              <p *ngIf="item.detail" class="mt-0.5 text-[13px] text-muted-foreground">{{ item.detail }}</p>
            </div>
            <a *ngIf="item.action" [routerLink]="item.action.route" [queryParams]="item.action.queryParams"
              class="btn btn-outline shrink-0 self-start !h-9 !px-3 !text-[13px] sm:self-auto">
              {{ item.action.label }}
            </a>
          </div>
        </li>
      </ul>
    </section>

    <ng-template #allClear>
      <p *ngIf="showAllClear" class="mb-5 flex items-center gap-2 text-[13px] text-muted-foreground" role="status">
        <svg viewBox="0 0 20 20" class="h-4 w-4 shrink-0 text-success-600" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="m5 10.5 3.2 3L15 6.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Todo en orden: no hay pendientes por atender.
      </p>
    </ng-template>
  `
})
export class AttentionListComponent {
  @Input() items: AttentionItem[] = [];
  /** Solo se afirma «todo en orden» cuando ya cargó todo lo que se revisa. */
  @Input() showAllClear = false;

  readonly tones = TONES;
  readonly icons = ICONS;

  trackById(_: number, item: AttentionItem): string {
    return item.id;
  }
}
