/**
 * Utilidades de presentación de la infraestructura fiscal (establecimientos,
 * puntos de emisión y secuencias). No asignan secuenciales: el consecutivo
 * oficial siempre lo controla el backend.
 */

export type FiscalDocumentType = 'Factura' | 'Nota de Credito' | 'Guia de Remision';
export type FiscalEnvironment = 'Pruebas' | 'Produccion';

export const FISCAL_DOCUMENTS: readonly { type: FiscalDocumentType; label: string; sriCode: string }[] = [
  { type: 'Factura', label: 'Factura', sriCode: '01' },
  { type: 'Nota de Credito', label: 'Nota de crédito', sriCode: '04' },
  { type: 'Guia de Remision', label: 'Guía de remisión', sriCode: '06' }
];

export const FISCAL_ENVIRONMENTS: readonly { value: FiscalEnvironment; label: string }[] = [
  { value: 'Pruebas', label: 'Pruebas' },
  { value: 'Produccion', label: 'Producción' }
];

export const MAX_SEQUENTIAL = 999999999;

export function normalizeFiscalText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

export function isActiveFiscalRecord(record: any): boolean {
  return normalizeFiscalText(record?.status || 'Activo') === 'ACTIVO';
}

export function fiscalFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

export function normalizeFiscalEnvironment(value: unknown): FiscalEnvironment {
  return normalizeFiscalText(value) === 'PRODUCCION' ? 'Produccion' : 'Pruebas';
}

export function fiscalEnvironmentLabel(value: unknown): string {
  return normalizeFiscalEnvironment(value) === 'Produccion' ? 'Producción' : 'Pruebas';
}

export function sequentialNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

/** Secuencial de 9 dígitos tal como se imprime en el comprobante. */
export function formatSequential(value: unknown): string {
  return String(sequentialNumber(value)).padStart(9, '0');
}

/** Serie fiscal `establecimiento-punto` (por ejemplo, 001-002). */
export function fiscalSeries(establishmentCode: unknown, emissionPointCode: unknown): string {
  const establishment = String(establishmentCode || '').trim() || '———';
  const point = String(emissionPointCode || '').trim() || '———';
  return `${establishment}-${point}`;
}

/** Número completo del comprobante: 001-002-000000026. */
export function fiscalDocumentNumber(establishmentCode: unknown, emissionPointCode: unknown, sequential: unknown): string {
  return `${fiscalSeries(establishmentCode, emissionPointCode)}-${formatSequential(sequential)}`;
}

export function fiscalRecordLabel(code: unknown, name: unknown): string {
  const normalizedCode = String(code || '').trim();
  const normalizedName = String(name || '').trim();
  return normalizedCode && normalizedName ? `${normalizedCode} · ${normalizedName}` : (normalizedCode || normalizedName || '—');
}
