import { expect, Page, test } from '@playwright/test';
import { BUSINESS, KEY, supplier, establishment, point, isolate } from './fixtures/electronic-documents';

async function fillFromSupplierInvoice(page: Page) {
  await page.getByLabel('Clave de acceso (49 dígitos)').fill(KEY);
  await expect(page.locator('#supplier-id')).toHaveValue(supplier.identification);
  await page.locator('#supplier-name').fill(supplier.supplier_name);
  await page.locator('#supplier-email').fill(supplier.email);
  await page.getByRole('button', { name: 'Guardar proveedor', exact: true }).click();
  await expect(page.getByText(supplier.supplier_name, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Número', { exact: true })).toHaveValue('001-001-000000123');
  await page.locator('#wh-tax-base-0').fill('100');
  await page.locator('#wh-tax-base-0').blur();
  await page.locator('#wh-ret-code-0').fill('312');
  await expect(page.locator('#wh-ret-pct-0')).toHaveValue('2.00');
  await expect(page.locator('#wh-ret-base-0')).toHaveValue('100.00');
}

test('retención crea proveedor desde clave y emite con totales y contrato correctos', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark');
  await page.goto('/portal/dashboard/withholdings/new');
  await expect(page.getByRole('heading', { name: 'Nueva retención' })).toBeVisible();
  await fillFromSupplierInvoice(page);
  await page.getByRole('button', { name: 'Emitir', exact: true }).click();
  await expect(page).toHaveURL(/\/withholdings\/FLRET-TEST$/);
  await expect(page.getByRole('heading', { name: 'Retención 001-001-000000001', exact: true })).toBeVisible();
  await expect(page.getByText('Autorizada', { exact: true }).first()).toBeVisible();
  const emitted = state.calls.filter(call => call.url.pathname.endsWith('create_and_emit_lite_withholding'));
  expect(emitted).toHaveLength(1);
  expect(emitted[0].method).toBe('POST');
  expect(emitted[0].body).toMatchObject({ business: BUSINESS, payload: { supplier: supplier.name,
    establishment: establishment.name, emission_point: point.name, environment: 'Pruebas',
    support: { num_doc_sustento: '001-001-000000123', taxes: [{ tax_code: '4', base_imponible: 100 }] },
    retentions: [{ tax_type: 'Renta', codigo_retencion: '312', base_imponible: 100, porcentaje: 2 }] } });
  expect(state.errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/facturada-2026-11-11-withholding-${info.project.name}.png`, fullPage: true });
});

test('sin agente de retención muestra bloqueo y no ofrece emitir', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', { agent: false });
  await page.goto('/portal/dashboard/withholdings/new');
  await expect(page.getByRole('alert')).toContainText('no está marcado como agente de retención');
  await expect(page.getByRole('button', { name: 'Emitir', exact: true })).toHaveCount(0);
  expect(state.calls.some(call => call.url.pathname.endsWith('create_and_emit_lite_withholding'))).toBe(false);
  expect(state.errors).toEqual([]);
});

test('lista conserva filtros en dirección, cuenta cero y ofrece Anuladas', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark');
  await page.goto('/portal/dashboard/withholdings?estado=Rechazada&q=Proveedor&desde=2026-11-01&hasta=2026-11-10');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Retenciones', exact: true })).toBeVisible();
  const request = state.calls.find(call => call.url.pathname.endsWith('get_all_withholdings'));
  expect(request?.url.searchParams.get('status')).toBe('CON_ERROR');
  expect(request?.url.searchParams.get('search')).toBe('Proveedor');
  expect(request?.url.searchParams.get('from_date')).toBe('2026-11-01');
  expect(request?.url.searchParams.get('to_date')).toBe('2026-11-10');
  await expect(page.getByRole('button', { name: /Anuladas/ })).toHaveCount(1);
  await expect(page.locator('app-list-filter-bar')).toContainText('0');
  expect(state.errors).toEqual([]);
});

test('SRI 70 permite consultar y no ofrece reemitir el comprobante', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', { processing: true });
  await page.goto('/portal/dashboard/withholdings/FLRET-TEST');
  await expect(page.getByRole('heading', { name: 'Retención 001-001-000000001', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Reintentar(?: envío)?|Reemitir|Emitir(?: retención)?)$/ })).toHaveCount(0);
  await page.getByRole('tab', { name: /Estado SRI/ }).click();
  const query = page.getByRole('button', { name: /Consultar autorización|Consultar estado|Consultar SRI/ }).first();
  await expect(query).toBeVisible();
  await page.screenshot({ path: `/tmp/facturada-2026-11-11-withholding-sri70-${info.project.name}.png`, fullPage: true });
  await query.click({ timeout: 5000 });
  await expect.poll(() => state.calls.filter(call => call.url.pathname.endsWith('refresh_lite_withholding_status')).length).toBe(1);
  expect(state.calls.some(call => call.url.pathname.endsWith('retry_lite_withholding'))).toBe(false);
  expect(state.errors).toEqual([]);
});

test('reabrir un borrador de renta 332 conserva el porcentaje válido de cero', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', { draftZero: true });
  await page.goto('/portal/dashboard/withholdings/FLRET-TEST/edit');
  await expect(page.getByRole('heading', { name: 'Editar retención', exact: true })).toBeVisible();
  await expect(page.locator('#wh-ret-code-0')).toHaveValue('332');
  await expect(page.locator('#wh-ret-pct-0')).toHaveValue('0.00');
  expect(state.errors).toEqual([]);
});
