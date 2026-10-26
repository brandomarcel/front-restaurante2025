/**
 * Cálculo de dinero en centavos enteros, idéntico al de la factura Lite
 * (`round_currency` + `calculate_totals`) y al backend de restaurante
 * (`facturada_restaurante/api/totals.py`).
 *
 * Trabajar en centavos evita los residuos de punto flotante (0.1 + 0.2 ≠ 0.3) y
 * garantiza que el total que ve el usuario sea el mismo que se factura y contra
 * el que se validan los pagos.
 */

/** Redondeo comercial (mitad lejos de cero) de un valor en dólares a centavos enteros. */
export function toCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // toPrecision corrige representaciones binarias como 1.005 * 100 = 100.49999…
  const scaled = Number((Math.abs(n) * 100).toPrecision(12));
  return Math.sign(n) * Math.round(scaled);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Redondeo comercial de un valor que ya está expresado en centavos (p. ej. un IVA de 187.5). */
function roundCents(cents: number): number {
  const scaled = Number(Math.abs(cents).toPrecision(12));
  return Math.sign(cents) * Math.round(scaled);
}

export interface LineCents {
  /** Base imponible: cantidad × precio − descuento. */
  taxable: number;
  tax: number;
  total: number;
}

/** Totales de una línea en centavos, en el mismo orden de redondeo que Lite. */
export function lineTotalsCents(qty: unknown, rate: unknown, discountAmount: unknown = 0, taxRate: unknown = 0): LineCents {
  const gross = toCents(Number(qty) * Number(rate));
  const discount = Math.min(toCents(discountAmount), gross);
  const taxable = Math.max(gross - discount, 0);
  const tax = roundCents(taxable * (Number(taxRate) || 0) / 100);
  return { taxable, tax, total: taxable + tax };
}

/**
 * Descuento (en centavos) que corresponde a `take` unidades de una línea con
 * `remainingQty` unidades y `remainingDiscountCents` de descuento sin asignar.
 * La última parte se lleva el saldo exacto. Misma regla que `split_discount_share`.
 */
export function splitDiscountShareCents(remainingQty: number, remainingDiscountCents: number, take: number): number {
  if (remainingQty <= 0 || remainingDiscountCents <= 0) return 0;
  if (roundQty(take) >= roundQty(remainingQty)) return remainingDiscountCents;
  return roundCents(remainingDiscountCents * take / remainingQty);
}

/** Cantidades de subcuenta: 6 decimales, igual que el backend. */
export function roundQty(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0;
}
