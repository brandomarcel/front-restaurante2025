import base from './playwright.withholdings.config';

export default {
  ...base,
  testMatch: 'purchase-settlements.e2e.spec.ts',
  outputDir: '/tmp/facturada-2026-11-11-final-purchase-settlements',
};
