import { Product } from 'src/app/core/models/product';

export function toInventoryBool(value: any): boolean {
  const normalized = `${value ?? ''}`.trim().toUpperCase();
  return value === true || value === 1 || normalized === '1' || normalized === 'TRUE' || normalized === 'SI';
}

export function toInventoryNumber(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hasInventoryControl(product: Partial<Product> | null | undefined): boolean {
  const item: any = product || {};
  const explicit =
    item.track_stock ??
    item.controlar_inventario ??
    item.maneja_stock ??
    item.manage_stock ??
    item.manages_stock ??
    item.stock_control;

  if (explicit !== undefined && explicit !== null && `${explicit}`.trim() !== '') {
    return toInventoryBool(explicit);
  }

  return item.stock_actual !== undefined ||
    item.available_stock !== undefined ||
    item.current_stock !== undefined ||
    item.stock !== undefined ||
    item.is_out_of_stock !== undefined;
}

export function allowNegativeStock(product: Partial<Product> | null | undefined): boolean {
  const item: any = product || {};
  return toInventoryBool(item.permitir_stock_negativo ?? item.allow_negative_stock);
}

export function getAvailableStock(product: Partial<Product> | null | undefined): number {
  const item: any = product || {};
  return toInventoryNumber(
    item.stock_actual ??
    item.available_stock ??
    item.current_stock ??
    item.stock,
    0
  );
}

/**
 * Un producto agrupador (con variantes) nunca tiene stock propio real: su
 * `current_stock` es siempre 0 porque nunca se vende directo. La
 * disponibilidad hay que mirarla en sus variantes, agregada por el backend
 * en `has_stock` (`get_productos`) para no consultar variante por variante
 * en cada tarjeta.
 */
function isVariantGrouper(product: Partial<Product> | null | undefined): boolean {
  return Number(product?.variant_count) > 0;
}

export function isOutOfStockProduct(product: Partial<Product> | null | undefined): boolean {
  if (isVariantGrouper(product)) {
    const hasStock = product?.has_stock;
    // `null`/`undefined` significa "el backend todavía no informa este dato":
    // no se bloquea a ciegas, se deja pasar al selector de variantes, que sí
    // valida el stock real de la variante elegida.
    if (hasStock === null || hasStock === undefined) return false;
    return !hasStock;
  }

  if (!hasInventoryControl(product)) {
    return false;
  }

  return toInventoryBool(product?.is_out_of_stock) || getAvailableStock(product) <= 0;
}

export function isLowStockProduct(product: Partial<Product> | null | undefined): boolean {
  if (!hasInventoryControl(product)) {
    return false;
  }

  const item: any = product || {};
  if (item.is_low_stock !== undefined && item.is_low_stock !== null) {
    return toInventoryBool(item.is_low_stock);
  }
  return getAvailableStock(product) <= toInventoryNumber(item.stock_minimo ?? item.minimum_stock ?? item.min_stock, 0);
}

export function canSellProduct(product: Partial<Product> | null | undefined): boolean {
  return !isOutOfStockProduct(product) || allowNegativeStock(product);
}

export function canUseInventoryQuantity(product: Partial<Product> | null | undefined, quantity: number): boolean {
  if (!hasInventoryControl(product)) {
    return true;
  }

  if (allowNegativeStock(product)) {
    return true;
  }

  return toInventoryNumber(quantity, 0) <= getAvailableStock(product);
}

export function getInventoryUnit(product: Partial<Product> | null | undefined): string {
  const item: any = product || {};
  return String(item.unidad_inventario || item.unidad || item.inventory_unit || item.stock_uom || '').trim() || 'und';
}

/**
 * Etiqueta de stock para tarjetas/listas de producto. En un agrupador con
 * variantes no hay un número de stock propio que mostrar (su `current_stock`
 * es siempre 0); se muestra la cantidad de variantes en su lugar.
 */
export function resolveInventoryLabel(product: Partial<Product> | null | undefined): string {
  if (isVariantGrouper(product)) {
    const count = Number(product?.variant_count) || 0;
    return `${count} ${count === 1 ? 'variante' : 'variantes'}`;
  }
  if (!hasInventoryControl(product)) {
    return 'Sin control';
  }
  return `${toInventoryNumber(product?.stock_actual, 0)} ${getInventoryUnit(product)}`;
}
