import { expect, Page, test } from '@playwright/test';
import { BUSINESS, establishment, point, individualSupplier, isolate } from './fixtures/electronic-documents';

async function selectSupplier(page: Page) {
  await page.getByRole('searchbox', { name: 'Buscar proveedor' }).fill('Proveedor');
  await page.getByRole('option', { name: /Proveedor ficticio/ }).click();
  await expect(page.getByText(individualSupplier.identification, { exact: false }).first()).toBeVisible();
}

async function fillItems(page: Page) {
  await page.locator('#ps-desc-0').fill('Café ficticio');
  await page.locator('#ps-qty-0').fill('2');
  await page.locator('#ps-price-0').fill('50');
  await page.locator('#ps-disc-0').fill('10');
  await page.locator('#ps-tax-0').selectOption('4');
  await page.locator('#ps-disc-0').blur();
}

test('liquidación calcula descuento e IVA y emite una sola vez con contrato 03', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', { settlement: true });
  await page.goto('/portal/dashboard/purchase-settlements/new');
  await expect(page.getByRole('heading', { name: 'Nueva liquidación de compra' })).toBeVisible();
  await selectSupplier(page);
  await fillItems(page);
  const total = page.locator('dl > div').filter({ has: page.locator('dt', { hasText: 'Total a pagar' }) });
  await expect(total.locator('dd')).toHaveText('103.50');
  await page.locator('#ps-payment').selectOption('20');
  await page.getByRole('button', { name: 'Emitir', exact: true }).click();
  await expect(page).toHaveURL(/\/purchase-settlements\/FLLIQ-TEST$/);
  await expect(page.getByText('Autorizada', { exact: true }).first()).toBeVisible();
  const calls = state.calls.filter(call => call.url.pathname.endsWith('create_and_emit_lite_purchase_settlement'));
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].url.origin).toBe('http://127.0.0.1:4230');
  expect(calls[0].body).toMatchObject({ business: BUSINESS, payload: {
    supplier: individualSupplier.name, forma_pago: '20', establishment: establishment.name,
    emission_point: point.name, environment: 'Pruebas',
    items: [{ descripcion: 'Café ficticio', cantidad: 2, precio_unitario: 50, descuento: 10, tax_code: '4' }],
  } });
  expect(state.errors).toEqual([]);
  await page.screenshot({ path: `/tmp/facturada-2026-11-11-settlement-${info.project.name}.png`, fullPage: true });
});

test('liquidación permite cédula, pasaporte o exterior y excluye RUC del alta de proveedor', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', { settlement: true });
  await page.goto('/portal/dashboard/purchase-settlements/new');
  await page.getByRole('button', { name: '+ Nuevo proveedor', exact: true }).click();
  await expect(page.locator('#supplier-id-type')).toHaveValue('05');
  expect(await page.locator('#supplier-id-type option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
    .toEqual(['05', '06', '08']);
  expect(state.calls.some(call => call.url.pathname.endsWith('create_and_emit_lite_purchase_settlement'))).toBe(false);
  expect(state.errors).toEqual([]);
});

for (const vat of [0, 15]) {
  test(`retención desde liquidación con IVA ${vat} % prellena sustento, renta y bases`, async ({ page }, info) => {
    const state = await isolate(page, info.project.name === 'mobile-dark', { settlement: true, vat });
    await page.goto('/portal/dashboard/withholdings/new?liquidacion=FLLIQ-TEST');
    await expect(page.getByRole('heading', { name: 'Nueva retención' })).toBeVisible();
    await expect(page.getByText(individualSupplier.supplier_name, { exact: true })).toBeVisible();
    await expect(page.locator('#wh-doc-type')).toHaveValue('03');
    await expect(page.locator('#wh-support')).toHaveValue(vat > 0 ? '01' : '02');
    await expect(page.locator('#wh-doc-number')).toHaveValue('001-001-000000002');
    await expect(page.locator('#wh-access-key')).toHaveValue('3'.repeat(49));
    await expect(page.locator('#wh-ret-code-0')).toHaveValue('311');
    await expect(page.locator('#wh-ret-pct-0')).toHaveValue('3.00');
    await expect(page.locator('#wh-ret-base-0')).toHaveValue('90.00');
    if (vat > 0) {
      await expect(page.locator('#wh-ret-pct-1 option:checked')).toHaveText('100 %');
      await expect(page.locator('#wh-ret-base-1')).toHaveValue('13.50');
    } else {
      await expect(page.locator('#wh-ret-pct-1')).toHaveCount(0);
    }
    expect(state.calls.some(call => call.url.pathname.endsWith('lookup_lite_access_key'))).toBe(false);
    expect(state.errors).toEqual([]);
  });
}

test('liquidación con retención vigente explica el bloqueo de anulación', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', { settlement: true, blockedAnnulment: true });
  await page.goto('/portal/dashboard/purchase-settlements/FLLIQ-TEST');
  await expect(page.getByText('La liquidación tiene una retención vigente. Anule primero la retención.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ya la anulé en el SRI', exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

for (const kind of ['withholding', 'purchase-settlement'] as const) {
  test(`diálogo de anulación ${kind} exige confirmar y usa el servicio del documento`, async ({ page }, info) => {
    const settlement = kind === 'purchase-settlement';
    const state = await isolate(page, info.project.name === 'mobile-dark', { settlement });
    const documentName = settlement ? 'FLLIQ-TEST' : 'FLRET-TEST';
    await page.goto(`/portal/dashboard/${settlement ? 'purchase-settlements' : 'withholdings'}/${documentName}`);
    await page.getByRole('button', { name: 'Ya la anulé en el SRI', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(settlement ? 'Liquidación de compra' : 'Retención');
    const confirm = dialog.getByRole('button', { name: 'Registrar anulación', exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Motivo', { exact: true }).selectOption(settlement ? 'Liquidación emitida por duplicado' : 'Retención emitida por duplicado');
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('checkbox').check();
    await expect(confirm).toBeEnabled();
    await page.screenshot({ path: `/tmp/facturada-2026-11-11-annul-${kind}-${info.project.name}.png`, fullPage: true });
    await confirm.click({ timeout: 5000 });
    const method = settlement ? 'register_lite_purchase_settlement_sri_annulment' : 'register_lite_withholding_sri_annulment';
    const request = state.calls.find(call => call.url.pathname.endsWith(method));
    expect(request?.method).toBe('POST');
    expect(request?.body).toMatchObject({ business: BUSINESS, confirmed_in_sri: 1,
      ...(settlement ? { settlement_name: documentName } : { withholding_name: documentName }) });
    await expect(page.getByText(settlement ? 'Liquidación anulada en el SRI' : 'Retención anulada en el SRI', { exact: true })).toBeVisible();
    expect(state.errors).toEqual([]);
  });
}
