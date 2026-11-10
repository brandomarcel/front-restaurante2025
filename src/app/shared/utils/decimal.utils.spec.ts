import {
  normalizeDecimalText,
  parseLocalizedDecimal,
  formatDecimalForInput,
  minDecimalsFromStep,
} from './decimal.utils';

describe('decimal.utils', () => {
  it('accepts comma or dot as decimal separator', () => {
    expect(parseLocalizedDecimal('10,50')).toBe(10.5);
    expect(parseLocalizedDecimal('10.50')).toBe(10.5);
  });

  it('normalizes common grouped amount formats', () => {
    expect(normalizeDecimalText('1.000,50')).toBe('1000.50');
    expect(normalizeDecimalText('1,000.50')).toBe('1000.50');
  });

  it('does not turn incomplete or invalid values into zero', () => {
    expect(parseLocalizedDecimal('')).toBeNull();
    expect(parseLocalizedDecimal('-')).toBeNull();
    expect(parseLocalizedDecimal('abc')).toBeNull();
  });
});

describe('decimales mínimos por tipo de campo', () => {
  it('dinero tiene dos decimales; cantidades y porcentajes no se rellenan', () => {
    expect(minDecimalsFromStep('0.01')).toBe(2);
    for (const step of ['1', 'any', null, '0', 'abc']) expect(minDecimalsFromStep(step)).toBe(0);
    expect(minDecimalsFromStep('0.00000001')).toBe(6);
  });
  it('rellena dinero sin recortar precios de mayor precisión', () => {
    expect(formatDecimalForInput(5.5, 2)).toBe('5.50');
    expect(formatDecimalForInput(5, 2)).toBe('5.00');
    expect(formatDecimalForInput(0, 2)).toBe('0.00');
    expect(formatDecimalForInput(1.2345, 2)).toBe('1.2345');
    expect(formatDecimalForInput(12.5, 0)).toBe('12.5');
  });
});
