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

/**
 * Decimales mínimos que se muestran según el `step` del campo: `0.01` → 2 (montos), `1` o `any` → 0.
 */
export function minDecimalsFromStep(step: string | null | undefined): number {
  const text = String(step ?? '').trim();
  if (!text || text === 'any' || !(Number(text) > 0)) return 0;
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : Math.min(text.length - dot - 1, 6);
}

/**
 * Texto que muestra un campo decimal: completa ceros hasta `minDecimals` (5.5 → «5.50»)
 * sin recortar los decimales que el valor ya tenga (1.2345 sigue «1.2345»).
 */
export function formatDecimalForInput(value: number, minDecimals = 0): string {
  const text = String(value);
  if (minDecimals <= 0 || /e/i.test(text)) return text;
  const dot = text.indexOf('.');
  const current = dot < 0 ? 0 : text.length - dot - 1;
  return current >= minDecimals ? text : value.toFixed(minDecimals);
}
