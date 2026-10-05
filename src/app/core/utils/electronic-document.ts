/** Presentation only: never mutate the fiscal status returned by Frappe. */
export function backendFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
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
    && !document?.replacement_invoice && !document?.replaced_by;
}

export function canRegenerateElectronicDocument(document: any): boolean {
  const e = document?.electronic ?? {};
  return canVerifyMissingSriDocument(document)
    && !!(e.manual_reviewed_at || document?.manual_reviewed_at)
    && !!(e.regeneration_reason || document?.regeneration_reason)
    && !backendFlag(e.manual_review_required ?? document?.manual_review_required);
}
