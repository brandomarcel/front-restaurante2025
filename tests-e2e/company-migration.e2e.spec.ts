import { test, expect } from '@playwright/test';
import context from './fixtures/migration-context.json';

const destination = { business: 'MIGRATION-DEST', name: 'Negocio de pruebas', tax_id: '1790012345001', inventory_mode: 'Simple', warehouses: [], imports: [] };

async function prepare(page: any, valid = true) {
  const confirmed: any[] = [];
  await page.route('https://**', (route: any) => route.abort());
  await page.route('**/socket.io/**', (route: any) => route.fulfill({ status: 503, body: '' }));
  await page.addInitScript((state: any) => {
    localStorage.setItem('active_business', state.business.name);
    localStorage.setItem('businessId', state.business.name);
    localStorage.setItem('access_token', 'frappe-session');
    localStorage.setItem('user', JSON.stringify({ email: 'operador@example.com', roles: ['Administrador'], full_name: 'Operador de pruebas' }));
    localStorage.setItem('company_capabilities', JSON.stringify({ ...state, loaded: true, activeBusiness: state.business, businessRole: 'Administrador' }));
  }, context);
  await page.route('**/api/**', async (route: any) => {
    const url = route.request().url();
    let message: any = { data: [] };
    if (url.includes('get_logged_user')) message = 'operador@example.com';
    else if (url.includes('get_csrf_token')) message = 'synthetic-test-csrf';
    else if (url.includes('get_businesses')) message = { data: [context.business] };
    else if (url.includes('get_user_context') || url.includes('get_empresa')) message = context;
    else if (url.includes('migration.service.get_context')) message = destination;
    else if (url.includes('migration.service.preview')) message = {
      name: 'PREVIEW-TEST', source_company: { name: 'COMP-TEST', business_name: 'Empresa anterior', tax_id: destination.tax_id },
      counts: { customers: 2, products: 3, invoices: 10, orders: 12 }, can_import: valid,
      errors: valid ? [] : ['Cierre o resuelva antes de migrar: Caja abierta.'], warnings: ['El stock se carga una sola vez.']
    };
    else if (url.includes('migration.service.confirm')) {
      confirmed.push(route.request().postDataJSON());
      message = { name: 'PREVIEW-TEST', status: 'Importado' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message }) });
  });
  return confirmed;
}

for (const width of [1280, 375]) {
  test(`revision y confirmacion en empresa explicita, ancho ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const confirmed = await prepare(page);
    await page.goto('/portal/dashboard/company-migration');
    await expect(page.getByRole('heading', { name: 'Importar desde Restaurante' })).toBeVisible();
    await page.getByTestId('migration-file').setInputFiles({ name: 'empresa.zip', mimeType: 'application/zip', buffer: Buffer.from('synthetic archive: backend mocked') });
    await page.getByTestId('migration-preview').click();
    await expect(page.getByText('Empresa anterior', { exact: true })).toBeVisible();
    expect(confirmed).toHaveLength(0);
    await page.getByTestId('migration-confirm').click();
    await expect(page.getByTestId('migration-success')).toBeVisible();
    expect(confirmed).toEqual([{ business: 'MIGRATION-DEST', name: 'PREVIEW-TEST' }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `/tmp/facturada-migration-${width}.png`, fullPage: true });
  });
}

test('no importa un archivo cuya revision devuelve errores', async ({ page }) => {
  const confirmed = await prepare(page, false);
  await page.goto('/portal/dashboard/company-migration');
  await page.getByTestId('migration-file').setInputFiles({ name: 'empresa.zip', mimeType: 'application/zip', buffer: Buffer.from('synthetic') });
  await page.getByTestId('migration-preview').click();
  await expect(page.getByTestId('migration-confirm')).toBeDisabled();
  await expect(page.getByText('Cierre o resuelva antes de migrar: Caja abierta.')).toBeVisible();
  expect(confirmed).toHaveLength(0);
});
