import { fiscalDocumentNumber, fiscalEnvironmentLabel, fiscalSeries, formatSequential, isActiveFiscalRecord, normalizeFiscalEnvironment } from './fiscal-setup';

describe('Fiscal setup presentation', () => {
  it('builds the printed document number from establishment, point and sequential', () => {
    expect(fiscalSeries('001', '002')).toBe('001-002');
    expect(fiscalDocumentNumber('001', '002', 26)).toBe('001-002-000000026');
    expect(formatSequential('abc')).toBe('000000000');
  });
  it('marks missing codes instead of inventing them', () => {
    expect(fiscalSeries('', '002')).toBe('———-002');
  });
  it('normalizes environments and statuses written with or without accents', () => {
    expect(normalizeFiscalEnvironment('Producción')).toBe('Produccion');
    expect(normalizeFiscalEnvironment(undefined)).toBe('Pruebas');
    expect(fiscalEnvironmentLabel('Produccion')).toBe('Producción');
    expect(isActiveFiscalRecord({ status: 'activo' })).toBeTrue();
    expect(isActiveFiscalRecord({ status: 'Inactivo' })).toBeFalse();
  });
});
