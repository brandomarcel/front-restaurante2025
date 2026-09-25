import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Product } from 'src/app/core/models/product';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { ProductsService } from 'src/app/services/products.service';
import { getAvailableStock, hasInventoryControl } from 'src/app/shared/utils/inventory.utils';
import {
  VariantAttributeDefinition,
  buildVariantDisplayName,
  findMatchingVariant,
  getVariantAttributeDefinitions,
  isSelectionComplete,
  isVariantActive
} from 'src/app/shared/utils/product-variants.utils';

interface VariantQueryOutcome {
  product: Product;
  variants?: Product[];
  error?: any;
}

/**
 * Selector de variantes reutilizable (POS, Facturación).
 *
 * `open(producto)` decide por sí solo si el producto necesita selección: si no
 * tiene variantes activas (o no tiene ninguna), resuelve de inmediato con el
 * producto recibido, sin mostrar ningún modal. Así un mismo punto de entrada
 * sirve tanto para productos antiguos sin variantes como para productos con
 * variantes, sin que el llamador tenga que saber cuál es cuál de antemano.
 *
 * Las consultas pasan por un `switchMap`: si el usuario selecciona otro
 * producto antes de que responda la anterior, esa petición se cancela y solo
 * se aplica el resultado del último producto pedido. El resultado exitoso se
 * cachea en memoria por `negocio + product_id` para no repetir la consulta si
 * el mismo producto se vuelve a tocar en la misma sesión.
 */
@Component({
  selector: 'app-product-variant-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-variant-picker.component.html'
})
export class ProductVariantPickerComponent implements OnDestroy {
  /** Emite el producto final que debe agregarse al carrito (la variante elegida, o el producto tal cual si no tiene variantes). */
  @Output() resolved = new EventEmitter<Product>();
  /** Emite cuando el usuario cierra el selector sin completar una selección. */
  @Output() cancelled = new EventEmitter<void>();

  isOpen = false;
  loading = false;
  errorMessage: string | null = null;
  parent: Product | null = null;
  attributeDefinitions: VariantAttributeDefinition[] = [];
  selection: Record<string, string> = {};
  activeVariants: Product[] = [];
  matchedVariant: Product | null = null;

  private readonly request$ = new Subject<Product>();
  private readonly subscription: Subscription;
  /** Cache en memoria por `negocio::product_id`. Vive mientras exista esta instancia del componente. */
  private readonly cache = new Map<string, Product[]>();

  constructor(
    private productsService: ProductsService,
    private capabilities: CompanyCapabilitiesService,
    private frappeErrorService: FrappeErrorService
  ) {
    this.subscription = this.request$.pipe(
      switchMap((product): import('rxjs').Observable<VariantQueryOutcome> => {
        const cacheKey = this.cacheKey(product.name);
        const cached = this.cache.get(cacheKey);
        if (cached) return of({ product, variants: cached });

        this.loading = true;
        this.errorMessage = null;
        return this.productsService.getVariantes(product.name).pipe(
          map((res:any) => ({ product, variants: res.data })),
          catchError((error) => of({ product, error }))
        );
      })
    ).subscribe((outcome) => this.handleOutcome(outcome));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  open(product: Product | null | undefined): void {
    if (!product?.name) return;

    // Un registro que ya es una variante (is_variant = 1) no vuelve a abrir el
    // selector: se agrega directamente, tal como pide la regla de compatibilidad.
    if (product.is_variant === 1 || product.is_variant === true) {
      this.resolved.emit(product);
      return;
    }

    // Ya hay una consulta en curso para este mismo producto: no se dispara
    // una segunda petición idéntica (doble clic, doble tap táctil, etc.).
    if (this.loading && this.parent?.name === product.name) return;

    this.parent = product;
    this.errorMessage = null;
    this.attributeDefinitions = [];
    this.activeVariants = [];
    this.selection = {};
    this.matchedVariant = null;
    // Se muestra de inmediato (con estado de carga) para que el usuario vea
    // que algo está pasando; si resulta ser un producto sin variantes, el
    // modal se vuelve a cerrar solo al llegar la respuesta.
    this.isOpen = true;
    this.loading = true;
    // Una única llamada por producto seleccionado; si ya había una en curso
    // para otro producto, `switchMap` la cancela y solo se aplica esta.
    this.request$.next(product);
  }

  /** Reintenta la última consulta que falló, sin cerrar el modal. */
  retry(): void {
    if (!this.parent) return;
    this.errorMessage = null;
    this.loading = true;
    this.request$.next(this.parent);
  }

  private handleOutcome(outcome: VariantQueryOutcome): void {
    this.loading = false;

    if (outcome.error) {
      // Un error real (red, backend) nunca se trata como "sin variantes": se
      // muestra el mensaje y se deja reintentar, para no facturar por error
      // el producto principal ni ocultar un problema real.
      this.errorMessage = this.frappeErrorService.handle(outcome.error) || 'No se pudo consultar las variantes de este producto.';
      this.isOpen = true;
      return;
    }

    const active = (outcome.variants || []).filter(isVariantActive);
    this.cache.set(this.cacheKey(outcome.product.name), active);

    if (!active.length) {
      // Producto simple (o sin variantes activas): se agrega directo, sin
      // fricción, igual que antes de que existieran variantes.
      this.resolved.emit(outcome.product);
      this.reset();
      return;
    }

    this.activeVariants = active;
    this.attributeDefinitions = getVariantAttributeDefinitions(active);
    this.selection = {};
    this.matchedVariant = null;
    this.isOpen = true;
  }

  selectAttribute(attribute: string, value: string): void {
    this.selection = { ...this.selection, [attribute]: value };
    this.matchedVariant = isSelectionComplete(this.attributeDefinitions, this.selection)
      ? findMatchingVariant(this.activeVariants, this.selection)
      : null;
  }

  isValueSelected(attribute: string, value: string): boolean {
    return this.selection[attribute] === value;
  }

  get selectionComplete(): boolean {
    return isSelectionComplete(this.attributeDefinitions, this.selection);
  }

  /** Regla exacta de bloqueo por stock: solo bloquea cuando el control está activo y no hay existencia. */
  private isVariantBlocked(variant: Product | null): boolean {
    if (!variant) return true;
    return Number(variant.track_stock) === 1 && Number(variant.current_stock) <= 0;
  }

  get canConfirm(): boolean {
    return !!this.matchedVariant && !this.isVariantBlocked(this.matchedVariant);
  }

  get stockBlockedMessage(): string | null {
    if (!this.matchedVariant || !this.isVariantBlocked(this.matchedVariant)) return null;
    return 'Esta variante no tiene stock disponible.';
  }

  displayName(variant: Product): string {
    return buildVariantDisplayName(this.parent, variant);
  }

  hasInventory(variant: Product | null): boolean {
    return hasInventoryControl(variant);
  }

  availableStock(variant: Product | null): number {
    return getAvailableStock(variant);
  }

  confirm(): void {
    if (!this.canConfirm || !this.matchedVariant) return;
    this.resolved.emit(this.matchedVariant);
    this.reset();
  }

  close(): void {
    this.cancelled.emit();
    this.reset();
  }

  /**
   * Invalida la caché de variantes. Hay que llamarlo después de cualquier
   * venta (el stock de la variante vendida cambió) o de crear/editar/borrar
   * una variante desde el admin: la caché no se entera sola de esos cambios,
   * porque vive en esta instancia y nunca vuelve a preguntarle al backend
   * mientras tenga una entrada guardada para ese producto.
   */
  clearCache(productId?: string): void {
    if (productId) {
      this.cache.delete(this.cacheKey(productId));
    } else {
      this.cache.clear();
    }
  }

  private cacheKey(productId: string): string {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || '';
    return `${business}::${productId}`;
  }

  private reset(): void {
    this.isOpen = false;
    this.loading = false;
    this.errorMessage = null;
    this.parent = null;
    this.attributeDefinitions = [];
    this.selection = {};
    this.activeVariants = [];
    this.matchedVariant = null;
  }
}
