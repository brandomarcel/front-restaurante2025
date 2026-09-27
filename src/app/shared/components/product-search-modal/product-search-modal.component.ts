import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  canSellProduct,
  getAvailableStock,
  getInventoryUnit,
  hasInventoryControl,
  isLowStockProduct,
  isOutOfStockProduct
} from 'src/app/shared/utils/inventory.utils';
import { formatVariantAttributes } from 'src/app/shared/utils/product-variants.utils';

/**
 * Búsqueda avanzada del POS (Ctrl+K / F3): no consulta nada nuevo al backend,
 * filtra en memoria la misma lista de productos ya cargada por la pantalla
 * que lo usa. Navegable 100% por teclado (↑↓ Enter Esc) o con mouse/touch.
 */
@Component({
  selector: 'app-product-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-search-modal.component.html'
})
export class ProductSearchModalComponent {
  /** Catálogo ya cargado por el host (pos-caja/pos-mesero); este componente nunca llama a un servicio. */
  @Input() products: any[] = [];
  /** El host decide qué hacer con el producto elegido (normalmente abrir el picker de variantes, igual que un clic en la tarjeta). */
  @Output() productSelected = new EventEmitter<any>();
  /** Se cerró sin elegir nada (Esc, clic afuera, botón cerrar): el host puede usarlo para devolver el foco al escáner. */
  @Output() closed = new EventEmitter<void>();

  @ViewChild('queryInput') queryInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('resultsList') resultsListRef?: ElementRef<HTMLElement>;

  isOpen = false;
  query = '';
  activeIndex = 0;

  open(): void {
    this.isOpen = true;
    this.query = '';
    this.activeIndex = 0;
    setTimeout(() => this.queryInputRef?.nativeElement?.focus(), 0);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.closed.emit();
  }

  get results(): any[] {
    const term = this.normalize(this.query);
    const list = !term
      ? this.products
      : this.products.filter((product) => {
        const haystack = this.normalize([
          product?.nombre,
          product?.variant_of_name,
          product?.codigo,
          product?.barcode,
          product?.codigo_barras,
          product?.categoria,
          product?.category,
          ...(Array.isArray(product?.attributes) ? product.attributes.map((a: any) => a?.value) : [])
        ].filter(Boolean).join(' '));
        return haystack.includes(term);
      });
    // Sin stock al final: lo primero que aparece es lo que sí se puede vender ya.
    return [...list].sort((a, b) => {
      const aOut = isOutOfStockProduct(a) ? 1 : 0;
      const bOut = isOutOfStockProduct(b) ? 1 : 0;
      return aOut - bOut;
    }).slice(0, 40);
  }

  onQueryChange(): void {
    this.activeIndex = 0;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const product = this.results[this.activeIndex];
      if (product) this.select(product);
    }
  }

  private moveActive(direction: 1 | -1): void {
    const total = this.results.length;
    if (!total) return;
    this.activeIndex = (this.activeIndex + direction + total) % total;
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    setTimeout(() => {
      const container = this.resultsListRef?.nativeElement;
      const row = container?.querySelector<HTMLElement>(`[data-index="${this.activeIndex}"]`);
      row?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  select(product: any): void {
    if (!this.canSelect(product)) return;
    // Solo cierra: no emite `closed` (eso significa "se cerró sin elegir
    // nada"), el host ya sabe que hubo selección por `productSelected`.
    this.isOpen = false;
    this.productSelected.emit(product);
  }

  canSelect(product: any): boolean {
    return !hasInventoryControl(product) || canSellProduct(product);
  }

  /** Nombre del producto principal si es una variante ("Polo Oversize"), o su propio nombre si no lo es. */
  displayName(product: any): string {
    return String(product?.variant_of_name || product?.nombre || '').trim();
  }

  /** "Color: Negro · Talla: M", o '' si no es una variante con atributos. */
  attributesLabel(product: any): string {
    const label = formatVariantAttributes(product);
    return label === '—' ? '' : label;
  }

  stockLabel(product: any): string {
    if (!hasInventoryControl(product)) return '';
    if (isOutOfStockProduct(product)) return 'Sin stock';
    if (isLowStockProduct(product)) return `Quedan ${getAvailableStock(product)} ${getInventoryUnit(product)}`;
    return `Stock ${getAvailableStock(product)} ${getInventoryUnit(product)}`;
  }

  stockClass(product: any): string {
    if (!hasInventoryControl(product)) return 'text-muted-foreground/60';
    if (isOutOfStockProduct(product)) return 'text-destructive';
    if (isLowStockProduct(product)) return 'text-amber-600';
    return 'text-emerald-600';
  }

  trackByProduct = (_: number, product: any) => product?.name || product?.codigo;

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }
}
