import { canConsultLiteInvoice, canRetryLiteInvoice, getLiteInvoiceAction } from './lite-invoice-actions';

describe('Acciones seguras de comprobantes Lite', () => {
  it('un comprobante migrado no permite consultar ni reemitir desde acciones operativas', () => {
    expect(getLiteInvoiceAction({ legacy_import: 'IMPORT-TEST', status: 'Rechazada' })).toBe('none');
    expect(getLiteInvoiceAction({ legacy_import: 'IMPORT-TEST', status: 'Emitida', sri_code: '70' })).toBe('none');
  });
  for (const code of ['43', '70']) {
    for (const fields of [
      { sri: { sri_code: code } },
      { electronic: { status_code: Number(code) } },
      { provider_status_code: code },
      { emission: { code } }
    ]) {
      it(`solo consulta el código ${code} en ${Object.keys(fields)[0]}, aunque el documento esté rechazado`, () => {
        const invoice = { status: 'Rechazada', ...fields };
        expect(getLiteInvoiceAction(invoice)).toBe('consult');
        expect(canConsultLiteInvoice(invoice)).toBeTrue();
        expect(canRetryLiteInvoice(invoice)).toBeFalse();
      });
    }
  }

  for (const provider_status of ['PROCESSING', 'RECEIVED', 'PENDING']) {
    it(`consulta ${provider_status} sin permitir reemisión`, () => {
      expect(getLiteInvoiceAction({ status: 'Error de Envio', provider_status })).toBe('consult');
    });
  }

  for (const invoice of [
    { status: 'Autorizada' }, { status: 'Anulada' }, { status: 'Reemplazada' },
    { status: 'Borrador' }, { status: 'Error', docstatus: 2 },
    { status: 'Emitida', regenerated_invoice: 'FLINV-TEST-REPLACEMENT' }
  ]) {
    it(`no ofrece acciones para documentos cerrados o borrador ${JSON.stringify(invoice)}`, () => {
      expect(getLiteInvoiceAction(invoice)).toBe('none');
      expect(canRetryLiteInvoice(invoice)).toBeFalse();
    });
  }

  it('consulta una conexión incierta con identidad sin inferir que no llegó al SRI', () => {
    expect(getLiteInvoiceAction({
      status: 'Error de Envio', access_key: 'TEST-KEY',
      electronic: { reception_status: 'UNKNOWN', authorization_status: 'PENDIENTE' }
    })).toBe('consult');
  });

  it('no habilita reintento durante revisión manual', () => {
    expect(getLiteInvoiceAction({ status: 'Rechazada', manual_review_required: '1' })).toBe('none');
  });

  it('reconoce devolución definitiva sin confundirla con recepción incierta', () => {
    expect(getLiteInvoiceAction({
      status: 'Rechazada', electronic: { reception_status: 'DEVUELTA', authorization_status: 'NO_AUTORIZADO' }
    })).toBe('retry');
  });

  it('consulta el mensaje de clave registrada aunque no venga el código', () => {
    expect(getLiteInvoiceAction({ status: 'Rechazada', sri_message: 'CLAVE ACCESO REGISTRADA' })).toBe('consult');
  });

  it('no inventa acciones si no hay contexto', () => {
    expect(getLiteInvoiceAction(null)).toBe('none');
  });
});
