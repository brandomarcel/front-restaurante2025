import { daysBetween, round2, WITHHOLDING_DAYS_LIMIT } from './withholding';
import {
  ELECTRONIC_DOCUMENT_KINDS,
  electronicDocumentKind,
  electronicDocumentKindConfig,
} from './electronic-document-kinds';

describe('Withholding presentation utilities', () => {
  it('calculates calendar days across months and leap day without timezone drift', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2026-11-05', '2026-11-10')).toBe(WITHHOLDING_DAYS_LIMIT);
    expect(daysBetween('2026-11-10', '2026-11-09')).toBe(-1);
    expect(daysBetween('', '2026-11-10')).toBeNull();
    expect(daysBetween('not-a-date', '2026-11-10')).toBeNull();
  });

  it('rejects impossible calendar dates instead of silently normalizing them', () => {
    expect(daysBetween('2026-02-30', '2026-03-02')).toBeNull();
    expect(daysBetween('2026-13-01', '2027-01-01')).toBeNull();
  });

  it('rounds display totals while preserving zero', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(100 * 0.15 * 0.7)).toBe(10.5);
    expect(round2(0)).toBe(0);
  });
});

describe('Electronic document kind compatibility', () => {
  it('keeps purchase settlements separate from invoice regeneration', () => {
    expect(electronicDocumentKindConfig('purchase-settlement')).toEqual({
      doctype: 'FacturADA Lite Purchase Settlement', detailMethod: 'get_lite_purchase_settlement_detail',
      reviewMethod: 'confirm_lite_purchase_settlement_electronic_review', reviewNameParam: 'settlement_name',
      invoiceLike: false, replacementRoute: null,
    });
  });
  it('preserves legacy guide/invoice booleans and credit-note methods', () => {
    expect(electronicDocumentKind(true)).toBe('guide');
    expect(electronicDocumentKind(false)).toBe('invoice');
    expect(electronicDocumentKindConfig(false).doctype).toBe('FacturADA Lite Invoice');
    expect(electronicDocumentKindConfig('credit-note').reviewMethod).toBe(
      ELECTRONIC_DOCUMENT_KINDS.invoice.reviewMethod,
    );
    expect(electronicDocumentKindConfig('credit-note').replacementRoute).toBe('/dashboard/credit-note');
  });

  it('routes withholding polling and review independently from invoices and guides', () => {
    expect(electronicDocumentKindConfig('withholding')).toEqual({
      doctype: 'FacturADA Lite Withholding',
      detailMethod: 'get_lite_withholding_detail',
      reviewMethod: 'confirm_lite_withholding_electronic_review',
      reviewNameParam: 'withholding_name',
      invoiceLike: false,
      replacementRoute: null,
    });
  });
});
