import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type PosPrintOption = 'comanda' | 'recibo' | 'ambas' | 'ticket' | 'ride' | 'skip';

/** Elección de impresión al terminar una venta. Qué abre cada opción lo decide el POS. */
@Component({
  selector: 'app-pos-print-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-modal="true" aria-labelledby="pos-print-title">
      <div class="relative w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6" (click)="$event.stopPropagation()">
        <button type="button" class="absolute right-3 top-3 h-8 w-8 rounded-md border border-border text-muted-foreground hover:bg-muted" (click)="close.emit()" aria-label="Cerrar">×</button>

        <div class="mb-4 flex items-start gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700" aria-hidden="true">✓</span>
          <div>
            <h3 id="pos-print-title" class="text-lg font-semibold text-foreground">{{ context === 'invoice' ? 'Venta registrada' : 'Pedido registrado' }}</h3>
            <p class="text-sm text-muted-foreground">{{ context === 'invoice' ? '¿Qué comprobante entregas al cliente?' : '¿Qué documento quieres imprimir?' }}</p>
          </div>
        </div>

        <div *ngIf="context === 'invoice'" class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button type="button" class="min-h-[52px] rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" (click)="choose.emit('ticket')">
            Ticket<span class="block text-[10px] font-normal opacity-80">Impresora térmica</span>
          </button>
          <button type="button" class="min-h-[52px] rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100" (click)="choose.emit('ride')">
            RIDE<span class="block text-[10px] font-normal opacity-80">Formato A4 del SRI</span>
          </button>
          <button type="button" class="min-h-[52px] rounded-lg border border-border bg-card px-3 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted" (click)="choose.emit('skip')">
            No imprimir
          </button>
        </div>

        <div *ngIf="context === 'order'" class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button type="button" class="min-h-[52px] rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100" (click)="choose.emit('comanda')">
            Comanda<span class="block text-[10px] font-normal opacity-80">Para cocina</span>
          </button>
          <button type="button" class="min-h-[52px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100" (click)="choose.emit('recibo')">
            Recibo<span class="block text-[10px] font-normal opacity-80">Para el cliente</span>
          </button>
          <button type="button" class="min-h-[52px] rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" (click)="choose.emit('ambas')">
            Ambas
          </button>
        </div>

        <div class="pt-4 text-center">
          <button type="button" class="text-sm text-muted-foreground underline hover:text-foreground" (click)="close.emit()">
            {{ context === 'order' ? 'Terminar' : 'Cerrar' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class PosPrintModalComponent {
  @Input() context: 'order' | 'invoice' = 'order';
  @Output() choose = new EventEmitter<PosPrintOption>();
  @Output() close = new EventEmitter<void>();
}
