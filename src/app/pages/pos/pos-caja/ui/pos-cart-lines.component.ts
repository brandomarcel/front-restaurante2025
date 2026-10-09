import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { formatVariantAttributes } from 'src/app/shared/utils/product-variants.utils';
import { CartService } from '../../services/cart.service';

/**
 * Líneas de la venta actual, en dos variantes:
 * - `panel` (venta en curso): compacta, solo cantidades, para que la lista se
 *   lea bien aunque haya muchos productos.
 * - `checkout` (modal de cobro): cantidades de solo lectura y un descuento por
 *   línea, en % o en $, siempre visible. Los descuentos se aplican al cobrar.
 * Las cantidades pasan por el POS (valida stock y avisa); los descuentos van a
 * CartService, que los recalcula y acota.
 */
@Component({
  selector: 'app-pos-cart-lines',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, DecimalInputDirective],
  template: `
    <div *ngIf="!cart.cart.length" class="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center">
      <span class="text-2xl text-muted-foreground/40" aria-hidden="true">🛒</span>
      <p class="text-[11px] font-semibold text-foreground/80">La venta está vacía</p>
      <p class="text-[10px] text-muted-foreground">Escanea un código o toca un producto para agregarlo.</p>
    </div>

    <!-- Panel de venta: compacto, solo cantidades. Los descuentos se aplican al cobrar. -->
    <ul *ngIf="cart.cart.length && variant === 'panel'" class="divide-y divide-border overflow-hidden rounded-md border border-border bg-card" aria-label="Productos de la venta">
      <li *ngFor="let item of cart.cart; trackBy: trackByLine" class="flex items-center gap-2 px-2 py-1.5">
        <div *ngIf="retail" class="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-muted">
          <img *ngIf="item.image_url" [src]="item.image_url" [alt]="item.nombre || item.name" class="h-full w-full object-cover" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[11px] font-semibold leading-4 text-foreground" [title]="item.nombre || item.name">{{ item.nombre || item.name }}</p>
          <p class="truncate text-[10px] leading-4 text-muted-foreground">
            \${{ item.price | number:'1.2-2' }} c/u<span *ngIf="retail && attributes(item) as attrs" class="text-primary"> · {{ attrs }}</span><span *ngIf="item.discount_total > 0" class="font-semibold text-emerald-700"> · Desc. −\${{ item.discount_total | number:'1.2-2' }}</span>
          </p>
        </div>
        <div class="inline-flex flex-shrink-0 items-center overflow-hidden rounded-md border border-border bg-card" role="group" [attr.aria-label]="'Cantidad de ' + (item.nombre || item.name)">
          <button type="button" (click)="decrease.emit(item)" class="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted"
            [attr.aria-label]="item.quantity > 1 ? 'Restar uno' : 'Quitar de la venta'">
            <fa-icon icon="minus" class="text-[9px]"></fa-icon>
          </button>
          <span class="flex h-7 min-w-[28px] items-center justify-center border-x border-border px-1 text-[12px] font-bold text-foreground" aria-live="polite">{{ item.quantity }}</span>
          <button type="button" (click)="increase.emit(item)" [disabled]="!canIncrease(item)"
            class="flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            [attr.aria-label]="canIncrease(item) ? 'Sumar uno' : 'Sin stock para sumar'">
            <fa-icon icon="plus" class="text-[9px]"></fa-icon>
          </button>
        </div>
        <strong class="w-16 flex-shrink-0 text-right text-[12px] text-foreground">\${{ item.total | number:'1.2-2' }}</strong>
        <button type="button" (click)="remove.emit(item)" class="inline-flex h-7 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-700"
          [attr.aria-label]="'Quitar ' + (item.nombre || item.name)" title="Quitar">
          <fa-icon icon="times" class="text-[10px]"></fa-icon>
        </button>
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
        </li>
      </ul>
    </div>
  `
})
export class PosCartLinesComponent {
  @Input() retail = false;
  /**
   * `panel`: venta en curso, compacta, con cantidades editables.
   * `checkout`: modal de cobro; cantidades de solo lectura y descuentos por línea.
   */
  @Input() variant: 'panel' | 'checkout' = 'panel';
  /** Se emite tras cambiar un descuento, para que el POS recalcule el cobro. */
  @Output() changed = new EventEmitter<void>();
  @Output() increase = new EventEmitter<any>();
  @Output() decrease = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();

  constructor(public readonly cart: CartService) {}

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

  trackByLine = (index: number, item: any): string => String(item?.name ?? item?.nombre ?? index);
}
