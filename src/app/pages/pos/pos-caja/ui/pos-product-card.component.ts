import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { hasInventoryControl, isLowStockProduct, isOutOfStockProduct, resolveInventoryLabel } from 'src/app/shared/utils/inventory.utils';

/**
 * Tarjeta de producto del POS. Solo presenta: si se puede agregar, si está en
 * favoritos y cuánto lleva la venta lo decide el POS (mismas reglas de stock
 * de CartService). Tiene dos formatos: Retail (foto protagonista) y General.
 */
@Component({
  selector: 'app-pos-product-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Retail: la foto es protagonista y el nombre/precio van superpuestos -->
    <div *ngIf="retail; else generalCard" role="button" tabindex="0" [attr.aria-disabled]="!canAdd"
      [attr.aria-label]="product.nombre + (canAdd ? '' : ' (no disponible)')"
      (click)="pick.emit(product)" (keydown.enter)="pick.emit(product)"
      class="group relative flex h-full touch-manipulation flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      [ngClass]="canAdd ? 'cursor-pointer border-border hover:border-primary/50' : 'cursor-not-allowed border-red-200 opacity-70'">
      <div class="relative aspect-square w-full overflow-hidden bg-muted">
        <img *ngIf="product.image_url" [src]="product.image_url" [alt]="product.nombre" class="pointer-events-none h-full w-full object-cover" loading="lazy" />
        <div *ngIf="!product.image_url" class="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground/70">Sin imagen</div>
        <span *ngIf="outOfStock" class="pointer-events-none absolute left-1 top-1 rounded bg-red-600 px-1 py-0.5 text-[8px] font-bold text-white">AGOTADO</span>
        <ng-container *ngTemplateOutlet="favoriteButton; context: { $implicit: 'retail' }"></ng-container>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 pb-1 pt-4">
          <p class="line-clamp-1 text-[10px] font-bold leading-tight text-white">{{ product.nombre }}</p>
          <p class="text-[11px] font-black leading-tight text-white">{{ hasVariants ? 'Ver variantes' : ('$' + (product.precio | number:'1.2-2')) }}</p>
        </div>
      </div>
      <!-- El stock queda fuera de la foto: sobre una imagen nunca hay contraste garantizado. -->
      <div class="flex items-center justify-between gap-1 px-1.5 py-1">
        <span *ngIf="hasInventory; else noStock" class="truncate text-[9px] font-semibold" [ngClass]="stockTone">{{ stockText }}</span>
        <ng-template #noStock><span></span></ng-template>
        <span *ngIf="cartQty" class="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary" [attr.aria-label]="cartQty + ' en la venta'">{{ cartQty }}</span>
      </div>
    </div>

    <ng-template #generalCard>
      <div role="button" tabindex="0" [attr.aria-disabled]="!canAdd" [attr.aria-label]="product.nombre + (canAdd ? '' : ' (no disponible)')"
        (click)="pick.emit(product)" (keydown.enter)="pick.emit(product)"
        class="relative flex h-full min-h-[150px] touch-manipulation flex-col rounded-xl border bg-card p-2.5 text-xs shadow-sm transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-3"
        [ngClass]="canAdd ? 'cursor-pointer border-border hover:border-primary/40 hover:shadow-md' : 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70'">
        <div class="mb-1.5 flex h-[92px] items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-[104px]">
          <img *ngIf="product.image_url" [src]="product.image_url" [alt]="product.nombre" class="pointer-events-none h-full w-full object-cover" loading="lazy" />
          <span *ngIf="!product.image_url" class="pointer-events-none text-[10px] text-muted-foreground/70">Sin imagen</span>
        </div>
        <span *ngIf="outOfStock" class="pointer-events-none absolute left-2 top-2 z-10 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">AGOTADO</span>
        <ng-container *ngTemplateOutlet="favoriteButton; context: { $implicit: 'general' }"></ng-container>

        <p class="line-clamp-2 min-h-[32px] font-bold leading-4 text-foreground">{{ product.nombre }}</p>
        <p class="mt-0.5 truncate text-[10px] text-muted-foreground">{{ product.descripcion || product.codigo || 'Sin descripción' }}</p>

        <div class="mt-auto pt-1">
          <div class="flex items-end justify-between gap-2">
            <p *ngIf="hasVariants" class="text-xs font-bold leading-none text-primary">Ver variantes</p>
            <ng-container *ngIf="!hasVariants">
              <p class="text-base font-bold leading-none text-foreground">\${{ product.precio | number:'1.2-2' }}</p>
              <span class="text-[10px] font-semibold text-muted-foreground">{{ product.tax_value }}% IVA</span>
            </ng-container>
          </div>
          <div class="mt-1 flex flex-wrap gap-1">
            <span *ngIf="hasVariants" class="badge badge-blue" title="El precio depende de la variante que elijas.">
              {{ product.variant_count }} {{ product.variant_count === 1 ? 'variante' : 'variantes' }}
            </span>
            <span *ngIf="hasInventory" class="badge" [ngClass]="outOfStock ? 'badge-red' : (lowStock ? 'badge-yellow' : 'badge-gray')">
              {{ outOfStock ? 'Sin stock' : (lowStock ? 'Bajo · ' + inventoryLabel : inventoryLabel) }}
            </span>
            <span *ngIf="cartQty" class="badge badge-blue">En venta {{ cartQty }}</span>
          </div>
        </div>
      </div>
    </ng-template>

    <ng-template #favoriteButton let-variant>
      <button type="button"
        class="absolute right-1.5 top-1.5 z-10 inline-flex items-center justify-center rounded-full transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        [ngClass]="[
          variant === 'retail' ? 'h-6 w-6 bg-black/45 text-[11px] backdrop-blur' : 'h-8 w-8 border bg-card/90 text-[13px] shadow-sm backdrop-blur',
          favorite ? (variant === 'retail' ? 'text-amber-400' : 'border-amber-300 text-amber-500') : (variant === 'retail' ? 'text-white/85' : 'border-border text-muted-foreground/60 hover:text-amber-500')
        ]"
        [attr.aria-label]="favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'" [attr.aria-pressed]="favorite"
        [attr.title]="favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'"
        [disabled]="!canAdd && !favorite"
        (click)="toggleFavorite.emit(product); $event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">★</button>
    </ng-template>
  `
})
export class PosProductCardComponent {
  @Input({ required: true }) product: any;
  @Input() retail = false;
  @Input() canAdd = true;
  @Input() favorite = false;
  @Input() cartQty = 0;
  @Output() pick = new EventEmitter<any>();
  @Output() toggleFavorite = new EventEmitter<any>();

  get hasVariants(): boolean { return (this.product?.variant_count || 0) > 0; }
  get hasInventory(): boolean { return hasInventoryControl(this.product); }
  get outOfStock(): boolean { return isOutOfStockProduct(this.product); }
  get lowStock(): boolean { return !this.outOfStock && isLowStockProduct(this.product); }
  get inventoryLabel(): string { return resolveInventoryLabel(this.product); }

  get stockText(): string {
    if (this.outOfStock) return 'Sin stock';
    return (this.lowStock ? 'Quedan ' : 'Stock ') + this.inventoryLabel;
  }

  get stockTone(): string {
    if (this.outOfStock) return 'text-red-600';
    return this.lowStock ? 'text-amber-600' : 'text-emerald-600';
  }
}
