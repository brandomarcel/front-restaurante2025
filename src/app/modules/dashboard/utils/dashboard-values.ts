/** Conversión defensiva de valores que llegan de Frappe (números como texto, 0/1, etc.). */

export function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const text = `${value ?? ''}`.trim().toLowerCase();
  return text === '1' || text === 'true';
}

/** Interpreta `YYYY-MM-DD` (o un datetime) como fecha local, sin desfase por zona horaria. */
export function parseLocalDate(value: unknown): Date | null {
  const datePart = `${value ?? ''}`.trim().split(/[T ]/)[0];
  const parts = datePart.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

/** Días calendario desde hoy hasta la fecha; negativo si ya pasó. */
export function daysUntil(value: unknown, today: Date = new Date()): number | null {
  const target = parseLocalDate(value);
  if (!target) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM-DD` → `DD-MM-YYYY`; devuelve `—` si no hay fecha. */
export function formatDisplayDate(value: unknown): string {
  const raw = `${value ?? ''}`.trim().split(/[T ]/)[0];
  if (!raw) return '—';
  const parts = raw.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : raw;
}

export function normalizeText(value: unknown): string {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}
