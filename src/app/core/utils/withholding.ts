/** Plazo del SRI: la retención se emite dentro de 5 días desde la factura del proveedor (el backend no bloquea). */
export const WITHHOLDING_DAYS_LIMIT = 5;

export function round2(value: number): number {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

/** Días calendario entre dos fechas `YYYY-MM-DD` (sin hora ni zona horaria); null si alguna no es válida. */
export function daysBetween(from: string, to: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').slice(0, 10));
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const time = Date.UTC(year, month - 1, day);
    // Date.UTC corrige sola una fecha imposible (30 de febrero → 2 de marzo, mes 13 → enero): se rechaza.
    const date = new Date(time);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : null;
  };
  const start = parse(from);
  const end = parse(to);
  return start === null || end === null ? null : Math.round((end - start) / 86_400_000);
}
