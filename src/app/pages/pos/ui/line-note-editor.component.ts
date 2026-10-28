import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartService, LINE_NOTE_MAX_LENGTH } from '../services/cart.service';

/** Indicaciones frecuentes para cocina: un toque las agrega o quita de la nota. */
export const LINE_NOTE_PRESETS = ['Sin azúcar', 'Sin hielo', 'Sin cebolla', 'Sin sal', 'Poco picante', 'Bien cocido', 'Para llevar'];

/**
 * Editor de la nota de cocina de una línea del carrito (POS Mesero y Cajero).
 * Con cantidad > 1 ofrece aplicar la nota a una sola unidad (línea aparte) o a
 * todas. Guarda mediante CartService y emite `done` al terminar o cancelar.
 */
@Component({
  selector: 'app-line-note-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-2 rounded-lg border border-amber-300 bg-card p-2">
      <div *ngIf="removable.length" class="space-y-1">
        <p class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Quitar del plato</p>
        <div class="flex flex-wrap gap-1.5">
          <button *ngFor="let line of removable" type="button"
            class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
            [ngClass]="isRemoved(line.ingredient) ? 'border-red-500 bg-red-500 text-white' : 'border-border bg-muted/50 text-foreground/80 hover:bg-muted'"
            [attr.aria-pressed]="isRemoved(line.ingredient)"
            (click)="toggleRemoved(line)">
            Sin {{ line.name }}
          </button>
        </div>
      </div>
      <p *ngIf="removable.length" class="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Otras indicaciones</p>
      <p *ngIf="!removable.length" class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Nota para cocina</p>
      <div class="flex flex-wrap gap-1.5">
        <button *ngFor="let preset of presets" type="button"
          class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
          [ngClass]="hasPreset(preset) ? 'border-amber-500 bg-amber-500 text-white' : 'border-border bg-muted/50 text-foreground/80 hover:bg-muted'"
          [attr.aria-pressed]="hasPreset(preset)"
          (click)="togglePreset(preset)">
          {{ preset }}
        </button>
      </div>
      <textarea rows="2" [maxlength]="maxLength"
        [(ngModel)]="draft" [ngModelOptions]="{ standalone: true }"
        placeholder="Ej. sin azúcar, poco hielo"
        aria-label="Nota para cocina"
        class="w-full resize-none rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"></textarea>
      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <button *ngIf="item.notes" type="button" class="mr-auto text-[11px] font-semibold text-red-600 hover:underline" (click)="save('')">Quitar nota</button>
        <button type="button" class="h-8 rounded-lg px-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted" (click)="done.emit()">Cancelar</button>
        <ng-container *ngIf="item.quantity > 1; else singleUnit">
          <button type="button" class="h-8 rounded-lg border border-amber-500 px-2.5 text-[11px] font-bold text-amber-700 dark:text-amber-300" (click)="save(draft, true)">Solo a 1</button>
          <button type="button" class="h-8 rounded-lg bg-amber-500 px-2.5 text-[11px] font-bold text-white" (click)="save(draft)">A las {{ item.quantity }}</button>
        </ng-container>
        <ng-template #singleUnit>
          <button type="button" class="h-8 rounded-lg bg-amber-500 px-3 text-[11px] font-bold text-white" (click)="save(draft)">Guardar nota</button>
        </ng-template>
      </div>
    </div>
  `
})
export class LineNoteEditorComponent implements OnInit {
  @Input({ required: true }) item: any;
  @Output() done = new EventEmitter<void>();

  readonly presets = LINE_NOTE_PRESETS;
  readonly maxLength = LINE_NOTE_MAX_LENGTH;
  draft = '';
  /** Ingredientes del plato que el cliente puede pedir «sin» (vienen del producto). */
  removable: Array<{ ingredient: string; name: string }> = [];
  private removed = new Set<string>();

  constructor(private readonly cart: CartService) {}

  ngOnInit(): void {
    this.draft = this.item?.notes || '';
    this.removable = this.item?.removable_ingredients || [];
    this.removed = new Set<string>(this.item?.removed_ingredients || []);
  }

  isRemoved(ingredient: string): boolean {
    return this.removed.has(ingredient);
  }

  /** Marca el insumo como quitado y deja «Sin X» en la nota para que cocina lo vea. */
  toggleRemoved(line: { ingredient: string; name: string }): void {
    if (this.removed.has(line.ingredient)) this.removed.delete(line.ingredient);
    else this.removed.add(line.ingredient);
    this.togglePreset(`Sin ${line.name}`);
  }

  hasPreset(preset: string): boolean {
    return this.parts().some((part) => part.toLowerCase() === preset.toLowerCase());
  }

  togglePreset(preset: string): void {
    const parts = this.parts();
    const index = parts.findIndex((part) => part.toLowerCase() === preset.toLowerCase());
    if (index >= 0) parts.splice(index, 1);
    else parts.push(preset);
    this.draft = parts.join(', ').slice(0, this.maxLength);
  }

  /** `onlyOneUnit`: con cantidad > 1, la nota va solo a una unidad (línea aparte). */
  save(note: string, onlyOneUnit = false): void {
    // Sin nota no hay insumos quitados: la nota es lo que ve cocina.
    this.cart.setNote(this.item, note, onlyOneUnit, note.trim() ? [...this.removed] : []);
    this.done.emit();
  }

  private parts(): string[] {
    return this.draft.split(',').map((part) => part.trim()).filter(Boolean);
  }
}
