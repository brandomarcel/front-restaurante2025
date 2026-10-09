/** Presentation only: never mutate the fiscal status returned by Frappe. */
export function backendFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

export function electronicReplacement(document: any): string {
  return String(document?.regenerated_invoice || document?.electronic?.regenerated_invoice
    || document?.replacement_invoice || document?.replaced_by || '').trim();
}

export function isClosedElectronicDocument(document: any): boolean {
  const status = String(document?.status ?? document?.einvoice_status ?? document?.sri?.status ?? '')
    .trim().toUpperCase();
  return !!electronicReplacement(document) || ['REEMPLAZADA', 'REPLACED', 'ANULADA', 'CANCELLED'].includes(status);
}

export function electronicDocumentLabel(document: any): string {
  const status = String(document?.status ?? '').trim();
  const phase = document?.electronic ?? {};
  if (status === 'Rechazada') {
    if (phase.authorization_status === 'NO_AUTORIZADO') return 'No autorizada';
    if (phase.reception_status === 'DEVUELTA') return 'Devuelta';
  }
  const labels: Record<string, string> = {
    'Pendiente Emision': 'Pendiente de emisión', Emitida: 'Autorización pendiente',
    'Error de Envio': 'Error de envío', 'En Revision': 'En revisión',
    AUTORIZADO: 'Autorizada', AUTHORIZED: 'Autorizada', RECHAZADO: 'Rechazada'
  };
  return labels[status] ?? (status || 'No informado');
}

export type ElectronicStatusTone = 'success' | 'danger' | 'warning' | 'neutral';

export interface ElectronicStatusView {
  label: string;
  tone: ElectronicStatusTone;
}

const STATUS_TONES: Record<string, ElectronicStatusTone> = {
  Autorizada: 'success',
  Rechazada: 'danger', 'No autorizada': 'danger', Devuelta: 'danger',
  Error: 'danger', 'Error de envío': 'danger', Anulada: 'danger',
  Reemplazada: 'neutral', Borrador: 'neutral', 'No informado': 'neutral'
};

/** Estados del flujo Restaurante, que no expone las fases SRI del contrato Lite. */
export function legacyInvoiceStatusLabel(document: any): string {
  const status = String(document?.status || document?.sri?.status || '').trim().toUpperCase();
  const provider = String(document?.sri?.provider_status || document?.provider_status || '').trim().toUpperCase();
  const code = String(document?.sri?.sri_code || document?.sri?.status_code || document?.sri?.code
    || document?.sri_code || document?.status_code || document?.provider_status_code || '').trim().toUpperCase();
  if (provider === 'AUTHORIZED') return 'Autorizada';
  if (status === 'EMITIDA' && (['PROCESSING', 'RECEIVED', 'PENDING'].includes(provider) || code === '70')) return 'Procesando';
  const labels: Record<string, string> = {
    AUTORIZADO: 'Autorizada', AUTORIZADA: 'Autorizada', AUTHORIZED: 'Autorizada', SRI_AUTHORIZED: 'Autorizada',
    REJECTED: 'Rechazada', RECHAZADO: 'Rechazada', RECHAZADA: 'Rechazada', NOT_AUTHORIZED: 'Rechazada', SRI_REJECTED: 'Rechazada',
    ERROR: 'Error', 'ERROR DE ENVIO': 'Error de envío', 'ERROR DE ENVÍO': 'Error de envío',
    QUEUED: 'En cola', 'EN COLA': 'En cola',
    PROCESSING: 'En proceso', ENVIADO: 'En proceso', FIRMADO: 'En proceso',
    'PENDIENTE EMISION': 'Pendiente emisión', 'PENDIENTE EMISIÓN': 'Pendiente emisión',
    EMITIDA: 'Emitida', DRAFT: 'Borrador', BORRADOR: 'Borrador',
    REEMPLAZADA: 'Reemplazada', REPLACED: 'Reemplazada', ANULADA: 'Anulada'
  };
  return labels[status] ?? (status || 'No informado');
}

/** Etiqueta y tono visual de un comprobante; nunca modifica su estado fiscal. */
export function electronicStatusView(document: any, liteMode: boolean): ElectronicStatusView {
  const label = liteMode ? electronicDocumentLabel(document) : legacyInvoiceStatusLabel(document);
  return { label, tone: STATUS_TONES[label] ?? 'warning' };
}

/** Valores exactos de `status` que acepta el backend (frontend_electronic_states.md). */
export const ELECTRONIC_STATUS_FILTERS = [
  'Borrador', 'Pendiente Emision', 'Emitida', 'Autorizada', 'Rechazada',
  'Error de Envio', 'En Revision', 'Reemplazada', 'Anulada'
] as const;

/** Las guías solo usan los siete primeros estados: nunca Reemplazada ni Anulada. */
export const REMISSION_GUIDE_STATUS_FILTERS = ELECTRONIC_STATUS_FILTERS.slice(0, 7);

export function electronicStatusFilterOptions(
  values: readonly string[], liteMode: boolean
): { value: string; label: string }[] {
  return values.map(value => ({ value, label: electronicStatusView({ status: value }, liteMode).label }));
}

export function hasDefinitiveElectronicState(document: any): boolean {
  const e = document?.electronic ?? {};
  return ['Autorizada', 'AUTORIZADO', 'AUTHORIZED', 'Rechazada', 'RECHAZADO', 'Reemplazada', 'Anulada'].includes(document?.status)
    || ['AUTHORIZED', 'REJECTED', 'NOT_AUTHORIZED'].includes(e.provider_status)
    || ['AUTORIZADO', 'NO_AUTORIZADO'].includes(e.authorization_status)
    || e.reception_status === 'DEVUELTA';
}

export function canVerifyMissingSriDocument(document: any): boolean {
  return ['Emitida', 'En Revision', 'Error de Envio', 'Pendiente Emision'].includes(document?.status)
    && !!(document?.electronic?.access_key || document?.access_key)
    && !hasDefinitiveElectronicState(document)
    && !isClosedElectronicDocument(document);
}

export function canRegenerateElectronicDocument(document: any): boolean {
  const e = document?.electronic ?? {};
  return canVerifyMissingSriDocument(document)
    && !!(e.manual_reviewed_at || document?.manual_reviewed_at)
    && !!(e.regeneration_reason || document?.regeneration_reason)
    && !backendFlag(e.manual_review_required ?? document?.manual_review_required);
}
