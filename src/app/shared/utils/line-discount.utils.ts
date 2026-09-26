/**
 * Cálculo único de descuentos por línea, usado por todos los formularios de
 * venta (POS, facturación directa, notas de venta, órdenes de restaurante).
 * El backend siempre recalcula y es la fuente definitiva; esto es solo para
 * que el usuario vea el total correcto mientras arma la venta.
 */

export interface LineDiscountInput {
  qty: number;
  rate: number;
  discountPercentage?: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface LineDiscountResult {
  subtotalBruto: number;
  discountFromPercentage: number;
  totalDiscount: number;
  baseImponible: number;
  iva: number;
  total: number;
}

export function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

/** Porcentaje válido: nunca negativo, nunca mayor a 100. */
export function clampDiscountPercentage(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

/**
 * Descuento fijo válido: nunca negativo, y nunca deja que el descuento total
 * de la línea supere su propio subtotal bruto.
 */
export function clampDiscountAmount(value: unknown, maxAllowed: number): number {
  const n = Number(value);
  const max = Math.max(0, Number(maxAllowed) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, n);
}

export function computeLineTotals(input: LineDiscountInput): LineDiscountResult {
  const qty = Math.max(0, Number(input.qty) || 0);
  const rate = Math.max(0, Number(input.rate) || 0);
  const taxRate = Math.max(0, Number(input.taxRate) || 0);

  const subtotalBruto = round2(qty * rate);
  const discountPercentage = clampDiscountPercentage(input.discountPercentage);
  const discountFromPercentage = round2(subtotalBruto * discountPercentage / 100);
  const maxFixedDiscount = Math.max(0, round2(subtotalBruto - discountFromPercentage));
  const discountAmount = clampDiscountAmount(input.discountAmount, maxFixedDiscount);
  const totalDiscount = round2(discountFromPercentage + discountAmount);
  const baseImponible = Math.max(0, round2(subtotalBruto - totalDiscount));
  const iva = round2(baseImponible * taxRate / 100);
  const total = round2(baseImponible + iva);

  return { subtotalBruto, discountFromPercentage, totalDiscount, baseImponible, iva, total };
}
