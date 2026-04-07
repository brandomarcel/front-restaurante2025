import { Product } from 'src/app/core/models/product';

export function toInventoryBool(value: any): boolean {
  return value === true || value === 1 || value === '1';
}

export function toInventoryNumber(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hasInventoryControl(product: Partial<Product> | null | undefined): boolean {
  return toInventoryBool(product?.controlar_inventario);
}

export function allowNegativeStock(product: Partial<Product> | null | undefined): boolean {
  return toInventoryBool(product?.permitir_stock_negativo);
}

export function isOutOfStockProduct(product: Partial<Product> | null | undefined): boolean {
  if (!hasInventoryControl(product)) {
    return false;
  }

  return toInventoryBool(product?.is_out_of_stock) || toInventoryNumber(product?.stock_actual, 0) <= 0;
}

export function isLowStockProduct(product: Partial<Product> | null | undefined): boolean {
  if (!hasInventoryControl(product)) {
    return false;
  }

  return toInventoryNumber(product?.stock_actual, 0) <= toInventoryNumber(product?.stock_minimo, 0);
}

export function canSellProduct(product: Partial<Product> | null | undefined): boolean {
  return !isOutOfStockProduct(product) || allowNegativeStock(product);
}

export function getInventoryUnit(product: Partial<Product> | null | undefined): string {
  return String(product?.unidad_inventario || '').trim() || 'und';
}
