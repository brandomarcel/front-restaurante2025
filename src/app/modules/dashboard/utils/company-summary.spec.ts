import { CompanySummary } from '../dashboard.models';
import { parseCompanySummary, signatureStatus } from './company-summary';

describe('parseCompanySummary', () => {
  it('lee el certificado del perfil tributario de get_lite_setup', () => {
    const summary = parseCompanySummary({
      business: { name: 'BUS-1', business_name: 'Café Central' },
      tax_profile: { environment: 'Produccion', has_certificate_password: 1, certificate_valid_to: '2027-01-31', certificate_status: 'Vigente' }
    });
    expect(summary).toEqual({
      name: 'Café Central',
      environment: 'Produccion',
      certificateMissing: false,
      certificateExpired: false,
      certificateValidTo: '2027-01-31'
    });
  });

  it('marca la firma faltante sin perfil tributario o con estado no utilizable', () => {
    expect(parseCompanySummary({ business: { name: 'BUS-1' }, tax_profile: null })?.certificateMissing).toBeTrue();
    expect(parseCompanySummary({ business: {}, tax_profile: { has_certificate_password: 1, certificate_status: 'Error de lectura' } })?.certificateMissing).toBeTrue();
  });

  it('no inventa datos cuando no hay respuesta', () => {
    expect(parseCompanySummary(null)).toBeNull();
  });
});

describe('signatureStatus', () => {
  const today = new Date(2026, 9, 8);
  const company = (overrides: Partial<CompanySummary>): CompanySummary => ({
    name: 'X', environment: '', certificateMissing: false, certificateExpired: false, certificateValidTo: '', ...overrides
  });

  it('distingue faltante, vencida, por vencer, pendiente y al día', () => {
    expect(signatureStatus(company({ certificateMissing: true }), today).label).toBe('Sin firma');
    expect(signatureStatus(company({ certificateValidTo: '2026-10-01' }), today).expired).toBeTrue();
    expect(signatureStatus(company({ certificateExpired: true, certificateValidTo: '2027-01-01' }), today).label).toBe('Vencida');
    expect(signatureStatus(company({ certificateValidTo: '2026-10-18' }), today).label).toBe('Vence en 10 días');
    expect(signatureStatus(company({}), today).label).toBe('Pendiente de validar');
    expect(signatureStatus(company({ certificateValidTo: '2027-10-08' }), today).label).toBe('Al día');
  });

  it('sin datos de empresa queda pendiente, nunca "Sin firma"', () => {
    expect(signatureStatus(null, today)).toEqual(jasmine.objectContaining({ label: 'Pendiente de validar', missing: false }));
  });
});
