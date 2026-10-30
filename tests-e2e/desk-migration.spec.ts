import { test, expect, Page } from '@playwright/test';

const deskScript = '/home/frappe/frappe-bench/apps/facturada_lite/facturada_lite/public/js/legacy_migration.js';
const jquery = '/home/frappe/frappe-bench/apps/frappe/frappe/public/js/lib/jquery/jquery.min.js';
const fixture = { name: 'PREVIEW-ONE', source_company: { name: 'COMP-TEST', business_name: '<script>bad()</script>', tax_id: '1790012345001' },
  counts: { customers: 3, invoices: 12 }, warnings: ['No se importan usuarios.'], errors: [], can_import: true };

async function desk(page: Page, result = fixture) {
  const calls: string[] = [];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.includes('/api/')) return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    calls.push(url);
    const message = url.includes('get_context') ? { name: 'Destino ficticio', tax_id: '1790012345001', inventory_mode: 'Simple' }
      : url.includes('.preview') ? result : { name: 'PREVIEW-ONE', status: 'Importado' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message }) });
  });
  await page.goto('http://desk.facturada.test/');
  await page.addScriptTag({ path: jquery });
  await page.evaluate(() => {
    const w = window as any, $ = w.$;
    w.__ = (value: string, args: string[] = []) => args.reduce((v, arg, i) => v.replace(`{${i}}`, arg), value);
    w.frappe = {
      provide: () => w.facturada = { migration: {} }, csrf_token: 'TEST',
      utils: { escape_html: (value: string) => $('<div>').text(value).html() },
      user: { has_role: () => true },
      call: async (options: any) => {
        const response = await fetch('/api/method/' + options.method, { method: options.type || 'POST', body: options.type === 'GET' ? undefined : JSON.stringify(options.args) });
        return response.json();
      },
      msgprint: (message: string) => w.lastMessage = message,
      confirm: (_: string, yes: any, no: any) => {
        $('<button id="approve">Confirmar</button>').appendTo('body').on('click', () => { $('#approve,#cancel').remove(); yes(); });
        $('<button id="cancel">Volver</button>').appendTo('body').on('click', () => { $('#approve,#cancel').remove(); no(); });
      },
      set_route: (...args: any[]) => w.lastRoute = args, show_alert: () => {},
      ui: { form: { on: () => {} }, Dialog: class {
        fields_dict: any = {}; $wrapper = $('<div>').appendTo('body'); action: any; primary = $('<button id="primary">').appendTo(this.$wrapper);
        constructor(options: any) {
          for (const field of options.fields) {
            const wrapper = $('<div>').appendTo(this.$wrapper);
            if (field.fieldtype === 'HTML') wrapper.html(field.options || '');
            else $('<input>').attr('data-fieldname', field.fieldname).val(field.default || '').appendTo(wrapper).on('change', () => field.onchange?.());
            this.fields_dict[field.fieldname] = { $wrapper: wrapper };
          }
          this.set_primary_action(options.primary_action_label, options.primary_action);
          this.primary.on('click', () => this.action());
        }
        get_value(name: string) { return this.fields_dict[name].$wrapper.find('input').val(); }
        set_value(name: string, value: any) { this.fields_dict[name].$wrapper.find('input').val(value || ''); }
        set_df_property(name: string, _: string, hidden: any) { this.fields_dict[name].$wrapper.toggle(!hidden); }
        set_primary_action(label: string, action: any) { this.primary.text(label); this.action = action; }
        get_primary_btn() { return this.primary; }
        show() {} hide() { this.$wrapper.remove(); }
      } },
    };
  });
  await page.addScriptTag({ path: deskScript });
  await page.evaluate(() => (window as any).facturada.migration.open('BUSINESS-TEST'));
  await page.locator('[data-migration-file]').setInputFiles({ name: 'empresa.zip', mimeType: 'application/zip', buffer: Buffer.from('ZIP fixture; parser tested in backend') });
  return calls;
}

test('Desk revisa antes de confirmar; doble clic no repite importación', async ({ page }) => {
  const calls = await desk(page);
  await page.locator('#primary').click();
  await expect(page.locator('#primary')).toHaveText('Confirmar importación');
  expect(calls.filter(v => v.includes('.confirm'))).toHaveLength(0);
  await expect(page.locator('body')).toContainText('<script>bad()</script>');
  expect(await page.locator('script').count()).toBe(2); // only test-injected scripts
  await page.locator('#primary').dblclick();
  await expect(page.locator('#approve')).toBeVisible();
  expect(calls.filter(v => v.includes('.confirm'))).toHaveLength(0);
  await page.locator('#approve').click();
  await expect.poll(() => calls.filter(v => v.includes('.confirm')).length).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as any).lastRoute)).toEqual(['Form', 'FacturADA Legacy Import', 'PREVIEW-ONE']);
});

test('Desk muestra errores y no habilita confirmación', async ({ page }) => {
  const calls = await desk(page, { ...fixture, can_import: false, errors: ['FACT-05438: falta número de autorización'] });
  await page.locator('#primary').click();
  await expect(page.locator('body')).toContainText('FACT-05438: falta número de autorización');
  await expect(page.locator('#primary')).toHaveText('Revisar archivo');
  await expect(page.getByText('Descargar diagnóstico')).toBeVisible();
  expect(calls.filter(v => v.includes('.confirm'))).toHaveLength(0);
});

test('Cambiar ZIP o negocio invalida la revisión anterior', async ({ page }) => {
  await desk(page);
  await page.locator('#primary').click();
  await expect(page.locator('#primary')).toHaveText('Confirmar importación');
  await page.locator('[data-migration-file]').setInputFiles({ name: 'otra.zip', mimeType: 'application/zip', buffer: Buffer.from('another') });
  await expect(page.locator('#primary')).toHaveText('Revisar archivo');
  await page.locator('#primary').click();
  await expect(page.locator('#primary')).toHaveText('Confirmar importación');
  await page.locator('[data-fieldname="business"]').fill('OTHER-BUSINESS');
  await page.locator('[data-fieldname="business"]').dispatchEvent('change');
  await expect(page.locator('#primary')).toHaveText('Revisar archivo');
});
