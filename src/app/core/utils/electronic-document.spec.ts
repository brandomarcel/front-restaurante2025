import { backendFlag, canVerifyMissingSriDocument, canRegenerateElectronicDocument, electronicDocumentLabel, electronicStatusView } from './electronic-document';
import { getLiteInvoiceAction } from './lite-invoice-actions';

describe('Electronic document contract', () => {
  it('does not treat string zero or false as a confirmation', () => {
    for (const value of [false, 0, '0', 'false', undefined]) expect(backendFlag(value)).toBeFalse();
    for (const value of [true, 1, '1']) expect(backendFlag(value)).toBeTrue();
  });
  it('distinguishes reception from authorization without changing status', () => {
    const document = { status: 'Rechazada', electronic: { reception_status: 'DEVUELTA' } };
    expect(electronicDocumentLabel(document)).toBe('Devuelta');
    expect(document.status).toBe('Rechazada');
    expect(electronicDocumentLabel({ status: 'Emitida' })).toBe('Autorización pendiente');
  });
  it('requires consultation for uncertain delivery and review states', () => {
    expect(getLiteInvoiceAction({ status: 'En Revision' })).toBe('consult');
    expect(getLiteInvoiceAction({ status: 'Error de Envio', electronic: { access_key: 'key' } })).toBe('consult');
    expect(getLiteInvoiceAction({ status: 'Pendiente Emision', electronic: { authorization_status: 'UNKNOWN' } })).toBe('consult');
  });
  it('never retries a review document using either current or historical status fields', () => {
    for (const document of [
      { status: 'En Revision' },
      { status: 'En Revisión', electronic: { manual_review_required: 1 } },
      { sri: { status: 'EN REVISION' } },
      { status: 'En Revision', emission: { status: 'ERROR' } }
    ]) expect(getLiteInvoiceAction(document)).toBe('consult');
  });
  it('blocks retry for pending manual review and historical documents', () => {
    expect(getLiteInvoiceAction({ status: 'Rechazada', electronic: { manual_review_required: 1 } })).toBe('none');
    expect(getLiteInvoiceAction({ status: 'Anulada' })).toBe('none');
    expect(getLiteInvoiceAction({ status: 'Reemplazada' })).toBe('none');
  });
  it('never enables regeneration from an ordinary review alone', () => {
    const document = { status: 'Emitida', electronic: { access_key: 'key', manual_reviewed_at: '2026-10-01' } };
    expect(canRegenerateElectronicDocument(document)).toBeFalse();
    expect(canRegenerateElectronicDocument({ ...document, electronic: { ...document.electronic, regeneration_reason: 'Verificado', manual_review_required: '0' } })).toBeTrue();
  });
  it('closes a replaced original even when its historical status is still pending', () => {
    for (const status of ['Emitida', 'En Revision', 'Error de Envio', 'Pendiente Emision', 'Rechazada']) {
      for (const replacement of [{ regenerated_invoice: 'FLINV-NEW' }, { electronic: { regenerated_invoice: 'FLINV-NEW' } }]) {
        const document = { status, access_key: 'key', manual_reviewed_at: '2026-10-01',
          regeneration_reason: 'Verificado', ...replacement };
        expect(getLiteInvoiceAction(document)).toBe('none');
        expect(canVerifyMissingSriDocument(document)).toBeFalse();
        expect(canRegenerateElectronicDocument(document)).toBeFalse();
      }
    }
  });
  it('retains consultation as the only action for SRI codes 43 and 70', () => {
    for (const code of ['43', '70']) {
      expect(getLiteInvoiceAction({ status: 'Error de Envio', emission: { sri_code: code } })).toBe('consult');
      expect(getLiteInvoiceAction({ status: 'Emitida', regenerated_invoice: 'FLINV-NEW', emission: { sri_code: code } })).toBe('none');
    }
  });
  it('derives a single label and tone for Lite and Restaurante badges', () => {
    expect(electronicStatusView({ status: 'Autorizada' }, true)).toEqual({ label: 'Autorizada', tone: 'success' });
    expect(electronicStatusView({ status: 'Rechazada', electronic: { authorization_status: 'NO_AUTORIZADO' } }, true))
      .toEqual({ label: 'No autorizada', tone: 'danger' });
    expect(electronicStatusView({ status: 'Emitida' }, true)).toEqual({ label: 'Autorización pendiente', tone: 'warning' });
    expect(electronicStatusView({ status: 'Reemplazada' }, true).tone).toBe('neutral');
    expect(electronicStatusView({ sri: { status: 'AUTORIZADO' } }, false)).toEqual({ label: 'Autorizada', tone: 'success' });
    expect(electronicStatusView({ status: 'Emitida', sri: { provider_status: 'PROCESSING' } }, false).label).toBe('Procesando');
    expect(electronicStatusView({}, false)).toEqual({ label: 'No informado', tone: 'neutral' });
  });
});
