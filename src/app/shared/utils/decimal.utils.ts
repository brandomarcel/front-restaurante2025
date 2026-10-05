/**
 * Convierte un número ingresado con separador decimal local o internacional.
 * Ejemplos válidos: 10,50 · 10.50 · 1.000,50 · 1,000.50.
 */
export function normalizeDecimalText(value: unknown): string {
  let text = String(value ?? '').trim().replace(/\s+/g, '');
  if (!text) return '';

  const negative = text.startsWith('-') ? '-' : '';
  text = text.replace(/-/g, '').replace(/[^0-9.,]/g, '');
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = text.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimalPart = text.slice(decimalIndex + 1).replace(/[.,]/g, '');
    return `${negative}${integerPart}.${decimalPart}`;
  }

  // Con un único separador, coma y punto representan el mismo decimal.
  if (lastComma >= 0) return `${negative}${text.replace(/,/g, '.')}`;
  return `${negative}${text}`;
}

export function parseLocalizedDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = normalizeDecimalText(value);
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}
