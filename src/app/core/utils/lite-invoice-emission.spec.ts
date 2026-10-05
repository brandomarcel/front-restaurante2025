import {
  liteEmissionState,
  liteEmissionMessages,
  normalizeLiteEmissionResponse
} from './lite-invoice-emission';

describe('FacturADA Lite emission responses', () => {
  it('keeps explicit failure authoritative over provider authorization', () => {
    expect(liteEmissionState({ ok: true, status: 'ERROR', provider_status: 'AUTHORIZED' })).toBe('ERROR');
    const result = normalizeLiteEmissionResponse({ message: { ok: false, emission: { ok: true, status: 'AUTHORIZED' } } });
    expect(result.state).toBe('ERROR');
    expect(result.emission.ok).toBeFalse();
  });
  it('reads persisted electronic phases without inventing reception', () => {
    const result = normalizeLiteEmissionResponse({ message: { data: { name: 'A', status: 'En Revision', electronic: { access_key: 'key', messages: 'Revisar', authorization_status: 'UNKNOWN' } } } });
    expect(result.accessKey).toBe('key');
    expect(result.emission.reception_status).toBeUndefined();
    expect(result.messages).toContain('Revisar');
  });
  it('recognizes an authorized invoice and preserves data', () => {
    const result = normalizeLiteEmissionResponse({
      message: {
        emission: { ok: true, code: 'SRI_AUTHORIZED', access_key: 'KEY-1' },
        data: { name: 'FLINV-00001' }
      }
    });

    expect(result.state).toBe('AUTHORIZED');
    expect(result.invoiceName).toBe('FLINV-00001');
    expect(result.accessKey).toBe('KEY-1');
  });

  it('recognizes processing without treating it as an error', () => {
    expect(liteEmissionState({ ok: true, code: 'SRI_RECEIVED' })).toBe('PROCESSING');
    expect(liteEmissionState({ ok: true, status: 'Emitida', provider_status: 'RECEIVED' })).toBe('PROCESSING');
    expect(liteEmissionState({ ok: true, status: 'Autorizada' })).toBe('AUTHORIZED');
    expect(liteEmissionState({ status: 'Emitida', sri_code: '70' })).toBe('PROCESSING');
  });

  it('normalizes wrapped message, message.data and data responses', () => {
    expect(normalizeLiteEmissionResponse({ message: { status: 'Autorizada', name: 'A' } }).state).toBe('AUTHORIZED');
    expect(normalizeLiteEmissionResponse({ message: { data: { status: 'Pendiente Emision', name: 'B' } } }).state).toBe('PROCESSING');
    expect(normalizeLiteEmissionResponse({ data: { status: 'Rechazada', name: 'C' } }).state).toBe('REJECTED');
  });

  it('returns every rejection message', () => {
    expect(liteEmissionMessages({ messages: ['Uno', { message: 'Dos' }] })).toEqual(['Uno', 'Dos']);
  });

  it('treats ok=true/status=ERROR as an error', () => {
    expect(liteEmissionState({ ok: true, status: 'ERROR' })).toBe('ERROR');
  });

  it('classifies provider connectivity failures separately', () => {
    expect(liteEmissionState({ ok: false, code: 'PROVIDER_TIMEOUT' })).toBe('PROVIDER_ERROR');
  });
});
