import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, DoCheck, ElementRef, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { formatVariantAttributes } from 'src/app/shared/utils/product-variants.utils';
import { CartService } from '../../services/cart.service';
import { LineNoteEditorComponent } from '../../ui/line-note-editor.component';

/**
 * Líneas de la venta actual, en dos variantes:
 * - `panel` (venta en curso): una fila compacta por producto con cantidad, total y
 *   nota para cocina (modo restaurante); el último producto elegido se resalta.
 *   Con una unidad, "−" pasa a quitar el producto.
 * - `checkout` (modal de cobro): cantidades de solo lectura y un descuento por
 *   línea, en % o en $, siempre visible. Los descuentos se aplican al cobrar.
 * Las cantidades pasan por el POS (valida stock y avisa); los descuentos van a
 * CartService, que los recalcula y acota.
 */
@Component({
  selector: 'app-pos-cart-lines',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, DecimalInputDirective, LineNoteEditorComponent],
  template: `
    <div *ngIf="!cart.cart.length" class="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center">
      <span class="text-2xl text-muted-foreground/40" aria-hidden="true">🛒</span>
      <p class="text-[11px] font-semibold text-foreground/80">La venta está vacía</p>
      <p class="text-[10px] text-muted-foreground">Escanea un código o toca un producto para agregarlo.</p>
    </div>

    <!-- Panel de venta: una fila compacta por producto (cantidad, total y nota para cocina). Los descuentos se aplican al cobrar. -->
    <ul *ngIf="cart.cart.length && variant === 'panel'" class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" aria-label="Productos de la venta">
      <li *ngFor="let item of cart.cart; trackBy: trackByLine"
        [id]="'cart-line-' + item.line_id"
        class="px-2 py-1 transition-colors duration-500"
        [ngClass]="{ 'bg-primary/10': highlightedLine === item.line_id }">
        <div class="flex items-center gap-1.5">
          <div *ngIf="retail" class="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-muted">
            <img *ngIf="item.image_url" [src]="item.image_url" [alt]="item.nombre || item.name" class="h-full w-full object-cover" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-[12px] font-semibold leading-4 text-foreground" [title]="item.nombre || item.name">{{ item.nombre || item.name }}</p>
            <div class="flex min-w-0 items-center gap-1 text-[10px] leading-4 text-muted-foreground">
              <span class="flex-shrink-0 tabular-nums">{{ item.quantity }}×\${{ item.price | number:'1.2-2' }}</span>
              <span *ngIf="attributes(item) as attrs" class="truncate text-primary">· {{ attrs }}</span>
              <span *ngIf="item.discount_total > 0" class="flex-shrink-0 font-semibold text-emerald-600">· −\${{ item.discount_total | number:'1.2-2' }}</span>
              <ng-container *ngIf="allowNotes">
                <button *ngIf="item.notes" type="button" (click)="toggleNote(item)"
                  class="min-w-0 truncate rounded bg-amber-500/15 px-1 font-bold text-amber-800 dark:text-amber-300"
                  [title]="'Editar nota: ' + item.notes">📝 {{ item.notes }}</button>
                <button *ngIf="!item.notes" type="button" (click)="toggleNote(item)"
                  class="flex-shrink-0 rounded px-1 font-semibold text-primary hover:bg-primary/10"
                  [attr.aria-label]="'Agregar nota para cocina a ' + (item.nombre || item.name)">+ Nota</button>
              </ng-container>
            </div>
          </div>

          <div class="inline-flex flex-shrink-0 items-center overflow-hidden rounded-md border border-border" role="group" [attr.aria-label]="'Cantidad de ' + (item.nombre || item.name)">
            <button type="button" (click)="decrease.emit(item)" class="flex h-7 w-7 items-center justify-center text-foreground/70 hover:bg-muted"
              [attr.aria-label]="item.quantity > 1 ? 'Restar uno' : 'Quitar de la venta'" [title]="item.quantity > 1 ? 'Restar uno' : 'Quitar'">
              <fa-icon [icon]="item.quantity > 1 ? 'minus' : 'trash'" class="text-[10px]" [ngClass]="{ 'text-destructive': item.quantity <= 1 }"></fa-icon>
            </button>
            <span class="flex h-7 min-w-[26px] items-center justify-center border-x border-border px-0.5 text-[12px] font-bold tabular-nums text-foreground" aria-live="polite">{{ item.quantity }}</span>
            <button type="button" (click)="increase.emit(item)" [disabled]="!canIncrease(item)"
              class="flex h-7 w-7 items-center justify-center text-foreground/70 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              [attr.aria-label]="canIncrease(item) ? 'Sumar uno' : 'Sin stock para sumar'">
              <fa-icon icon="plus" class="text-[10px]"></fa-icon>
            </button>
          </div>

          <strong class="w-[62px] flex-shrink-0 text-right text-[12px] tabular-nums text-foreground">\${{ item.total | number:'1.2-2' }}</strong>
        </div>

        <app-line-note-editor *ngIf="allowNotes && editingLine === item.line_id" class="mb-1 mt-1.5 block" [item]="item" (done)="editingLine = null"></app-line-note-editor>
      </li>
    </ul>

    <!-- Cobro: aquí se aplican los descuentos. Se escriben directo, sin botones intermedios. -->
    <div *ngIf="cart.cart.length && variant === 'checkout'" class="overflow-hidden rounded-md border border-border bg-card">
      <div class="grid grid-cols-[minmax(0,1fr)_64px_72px_76px] items-center gap-2 border-b border-border bg-muted/50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>Producto</span><span class="text-center">Desc. %</span><span class="text-center">Desc. $</span><span class="text-right">Total</span>
      </div>
      <ul class="divide-y divide-border" aria-label="Productos y descuentos">
        <li *ngFor="let item of cart.cart; trackBy: trackByLine" class="grid grid-cols-[minmax(0,1fr)_64px_72px_76px] items-center gap-2 px-2.5 py-2">
          <div class="min-w-0">
            <p class="truncate text-[12px] font-semibold text-foreground" [title]="item.nombre || item.name">{{ item.nombre || item.name }}</p>
            <p class="text-[11px] text-muted-foreground">{{ item.quantity }} × \${{ item.price | number:'1.2-2' }}</p>
            <ng-container *ngIf="allowNotes; else readOnlyNote">
              <button *ngIf="item.notes && editingLine !== item.line_id" type="button" (click)="toggleNote(item)"
                class="max-w-full truncate rounded bg-amber-500/15 px-1 text-left text-[10px] font-bold text-amber-800 dark:text-amber-300"
                [title]="'Editar nota: ' + item.notes">📝 {{ item.notes }}</button>
              <button *ngIf="!item.notes && editingLine !== item.line_id" type="button" (click)="toggleNote(item)"
                class="rounded px-1 text-[10px] font-semibold text-primary hover:bg-primary/10"
                [attr.aria-label]="'Agregar nota para cocina a ' + (item.nombre || item.name)">+ Nota</button>
            </ng-container>
            <ng-template #readOnlyNote>
              <p *ngIf="item.notes" class="truncate text-[10px] font-bold text-amber-700 dark:text-amber-300" [title]="item.notes">📝 {{ item.notes }}</p>
            </ng-template>
          </div>
          <input type="text" inputmode="decimal" appDecimalInput min="0" max="100" step="1" placeholder="0"
            [attr.aria-label]="'Descuento en porcentaje de ' + (item.nombre || item.name)"
            [ngModel]="item.discount_percentage || null" [ngModelOptions]="{ standalone: true }" (ngModelChange)="applyPercent(item, $event)"
            class="h-8 w-full rounded-md border border-border bg-card px-2 text-center text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <input type="text" inputmode="decimal" appDecimalInput min="0" step="0.01" placeholder="0.00"
            [attr.aria-label]="'Descuento en dólares de ' + (item.nombre || item.name)"
            [ngModel]="item.discount_amount || null" [ngModelOptions]="{ standalone: true }" (ngModelChange)="applyAmount(item, $event)"
            class="h-8 w-full rounded-md border border-border bg-card px-2 text-center text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <div class="text-right">
            <p class="text-[13px] font-bold text-foreground">\${{ item.total | number:'1.2-2' }}</p>
            <p *ngIf="item.discount_total > 0" class="text-[10px] font-semibold text-emerald-700">ahorra \${{ item.discount_total | number:'1.2-2' }}</p>
          </div>
          <!-- Última revisión antes de enviar a cocina: la nota también se edita en el cobro -->
          <app-line-note-editor *ngIf="allowNotes && editingLine === item.line_id" class="col-span-4 block" [item]="item" (done)="editingLine = null; changed.emit()"></app-line-note-editor>
        </li>
      </ul>
    </div>
  `
})
export class PosCartLinesComponent implements DoCheck, AfterViewChecked, OnDestroy {
  @Input() retail = false;
  /**
   * `panel`: venta en curso, compacta, con cantidades editables.
   * `checkout`: modal de cobro; cantidades de solo lectura y descuentos por línea.
   */
  @Input() variant: 'panel' | 'checkout' = 'panel';
  /** Notas de cocina por línea: solo para órdenes de restaurante, no en el POS genérico. */
  @Input() allowNotes = false;
  /** Línea (line_id) cuya nota se está editando. */
  editingLine: number | null = null;
  /** Se emite tras cambiar un descuento, para que el POS recalcule el cobro. */
  @Output() changed = new EventEmitter<void>();
  @Output() increase = new EventEmitter<any>();
  @Output() decrease = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();

  /** Línea recién agregada/incrementada, resaltada un momento para ubicarla. */
  highlightedLine: number | null = null;
  private seenTouchedLine: number | null = null;
  private pendingScroll = false;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(public readonly cart: CartService, private readonly host: ElementRef<HTMLElement>) {}

  /** Detecta el producto recién elegido para resaltarlo y dejarlo a la vista (con su "+ Nota"). */
  ngDoCheck(): void {
    if (this.variant !== 'panel') return;
    const touched = this.cart.lastTouchedLineId;
    if (touched === this.seenTouchedLine) return;
    this.seenTouchedLine = touched;
    if (touched == null) return;
    this.highlightedLine = touched;
    this.pendingScroll = true;
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightedLine = null, 1500);
  }

  ngAfterViewChecked(): void {
    if (!this.pendingScroll) return;
    this.pendingScroll = false;
    const row = this.host.nativeElement.querySelector(`#cart-line-${this.highlightedLine}`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
  }

  /** Mismo comportamiento que antes del rediseño: % y $ se combinan y CartService los acota. */
  applyPercent(item: any, value: unknown): void {
    this.cart.setDiscountPercentage(item, value);
    this.changed.emit();
  }

  applyAmount(item: any, value: unknown): void {
    this.cart.setDiscountAmount(item, value);
    this.changed.emit();
  }

  canIncrease(item: any): boolean {
    return this.cart.canIncrease(item);
  }

  /** "Color: Negro · Talla: M", o vacío si la línea no es una variante. */
  attributes(item: any): string {
    const label = formatVariantAttributes(item);
    return label === '—' ? '' : label;
  }

  toggleNote(item: any): void {
    this.editingLine = this.editingLine === item.line_id ? null : item.line_id;
  }

  /** Un producto puede ocupar varias líneas (notas distintas): se identifica por línea. */
  trackByLine = (index: number, item: any): string => String(item?.line_id ?? item?.name ?? item?.nombre ?? index);
}
