import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Ayuda de atajos de teclado del POS: solo informativa. */
@Component({
  selector: 'app-pos-shortcuts-help',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-modal-backdrop" (click)="close.emit()">
      <div class="app-modal !max-w-lg !rounded-2xl !shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="pos-shortcuts-title" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <h3 id="pos-shortcuts-title" class="text-sm font-bold text-foreground">Atajos de teclado</h3>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted" (click)="close.emit()" aria-label="Cerrar">×</button>
        </div>
        <div class="grid grid-cols-1 gap-4 px-4 py-4 text-xs sm:grid-cols-2">
          <section *ngFor="let group of groups">
            <p class="mb-1.5 font-bold uppercase tracking-wide text-muted-foreground">{{ group.title }}</p>
            <dl class="space-y-1">
              <div *ngFor="let shortcut of group.items" class="flex items-center justify-between gap-2">
                <dt><kbd class="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{{ shortcut.keys }}</kbd></dt>
                <dd>{{ shortcut.action }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  `
})
export class PosShortcutsHelpComponent {
  @Input() genericMode = false;
  @Output() close = new EventEmitter<void>();

  get groups(): { title: string; items: { keys: string; action: string }[] }[] {
    return [
      {
        title: 'Venta',
        items: [
          { keys: 'F3', action: 'Buscar producto' },
          { keys: 'Ctrl + K', action: 'Buscar producto' },
          { keys: 'F10', action: this.genericMode ? 'Cobrar y emitir' : 'Cobrar' },
          { keys: 'Esc', action: 'Cerrar ventana actual' }
        ]
      },
      {
        title: 'Variantes',
        items: [
          { keys: '◄ ►', action: 'Cambiar opción' },
          { keys: 'Tab', action: 'Moverse entre atributos' },
          { keys: 'Enter', action: 'Agregar al carrito' },
          { keys: 'Esc', action: 'Cerrar selección' }
        ]
      }
    ];
  }
}
