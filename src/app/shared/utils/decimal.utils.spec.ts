import { normalizeDecimalText, parseLocalizedDecimal } from './decimal.utils';

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
