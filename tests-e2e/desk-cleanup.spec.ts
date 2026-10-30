import { test, expect, Page } from '@playwright/test';

const script = '/home/frappe/frappe-bench/apps/facturada_lite/facturada_lite/public/js/test_document_cleanup.js';
const fixture = { business: 'BUSINESS-TEST', business_name: 'Empresa de pruebas', counts: { Facturas: 2, 'Notas de credito': 1, 'Guias de remision': 0 }, total: 3,
  files: 1, blockers: [], can_delete: true, preview_hash: 'PREVIEW', confirmation: 'ELIMINAR PRUEBAS BUSINESS-TEST', preserved: ['Produccion', 'secuencias', 'stock'] };

async function setup(page: Page, plan: any = fixture, manager = true) {
  const calls: { method: string; args: any }[] = [];
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto('http://desk.facturada.test/');
  await page.addScriptTag({ path: '/home/frappe/frappe-bench/apps/frappe/frappe/public/js/lib/jquery/jquery.min.js' });
  await page.exposeFunction('deskCall', async (options: any) => {
    calls.push({ method: options.method, args: options.args });
    if (options.method.endsWith('preview')) return { message: plan };
    await new Promise(resolve => setTimeout(resolve, 100));
    return { message: { total: 3 } };
  });
  await page.evaluate(({ manager }) => {
    const w = window as any, $ = w.$;
    w.__ = (value: string, args: string[] = []) => args.reduce((v, arg, i) => v.replace(`{${i}}`, arg), value);
    w.frappe = { user: { has_role: () => manager }, utils: { escape_html: (value: string) => $('<div>').text(value).html() },
      call: (options: any) => w.deskCall(options), msgprint: (message: string) => w.lastMessage = message,
      ui: { form: { on: (_: string, handlers: any) => w.handlers = handlers }, Dialog: class {
        wrapper = $('<div>').appendTo('body'); primary = $('<button id="cleanup-primary">').appendTo(this.wrapper);
        constructor(options: any) {
          for (const field of options.fields) {
            if (field.fieldtype === 'HTML') $('<div>').html(field.options).appendTo(this.wrapper);
            else $('<input id="confirmation">').appendTo(this.wrapper);
          }
          if (options.primary_action) this.primary.text(options.primary_action_label).on('click', () => options.primary_action({ confirmation: $('#confirmation').val() }));
          else this.primary.remove();
        }
        get_primary_btn() { return this.primary; } show() {} hide() { this.wrapper.remove(); }
      } },
    };
  }, { manager });
  await page.addScriptTag({ path: script });
  await page.evaluate(() => {
    const w = window as any;
    w.handlers.refresh({ is_new: () => false, doc: { name: 'BUSINESS-TEST' }, reload_doc: () => w.reloaded = true,
      add_custom_button: (label: string, action: any) => w.$('<button id="cleanup">').text(label).on('click', action).appendTo('body') });
  });
  return calls;
}

test('limpieza Desk exige vista previa y frase; doble clic no duplica borrado', async ({ page }) => {
  const calls = await setup(page);
  await page.locator('#cleanup').click();
  await expect(page.locator('body')).toContainText('No reinicia secuencias');
  expect(calls.filter(v => v.method.endsWith('execute'))).toHaveLength(0);
  await page.locator('#confirmation').fill('incorrecto');
  await page.locator('#cleanup-primary').click();
  expect(calls.filter(v => v.method.endsWith('execute'))).toHaveLength(0);
  await page.locator('#confirmation').fill(fixture.confirmation);
  await page.locator('#cleanup-primary').dblclick();
  await expect.poll(() => calls.filter(v => v.method.endsWith('execute')).length).toBe(1);
  expect(calls.find(v => v.method.endsWith('execute'))?.args).toEqual({ business: fixture.business, confirmation: fixture.confirmation, preview_hash: fixture.preview_hash });
  await expect.poll(() => page.evaluate(() => (window as any).reloaded)).toBe(true);
});

test('vínculos operativos bloquean el botón de borrado', async ({ page }) => {
  const calls = await setup(page, { ...fixture, can_delete: false, blockers: [{ name: 'TEST-INVOICE', reference_doctype: 'Stock', reference_name: 'MOV-ONE' }] });
  await page.locator('#cleanup').click();
  await expect(page.locator('body')).toContainText('MOV-ONE');
  await expect(page.locator('#cleanup-primary')).toHaveCount(0);
  expect(calls.filter(v => v.method.endsWith('execute'))).toHaveLength(0);
});

test('administrador de negocio sin System Manager no recibe botón', async ({ page }) => {
  const calls = await setup(page, fixture, false);
  await expect(page.locator('#cleanup')).toHaveCount(0);
  expect(calls).toHaveLength(0);
});
