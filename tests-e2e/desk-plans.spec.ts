import { test, expect, Page } from '@playwright/test';

type Call = { method: string; url: string; body: any };

async function desk(page: Page, scheduled = false) {
  const calls: Call[] = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!url.includes('/api/')) return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    const catalog = new URL(url).pathname.endsWith('get_plan_catalog');
    calls.push({ method: request.method(), url, body: request.postDataJSON() });
    if (request.method() !== (catalog ? 'GET' : 'POST'))
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{"exception":"Not permitted"}' });
    const data = catalog ? [{ code: 'TEST', name: 'Plan ficticio', description: 'Plan local',
      quota_mode: 'Mixto', billing_period: 'Total', duration_months: 1, max_authorized_documents: 100,
      max_users: 3, unlimited_documents: 0, price: 15, modules: { enable_billing: 1 } },
      { code: 'RESTO_BASICO', name: 'Restaurante Básico', description: 'Plan local', modules: { enable_billing: 1, enable_restaurant: 1 } }]
      : { status: 'Aplicado', subscription: 'SUB-TEST', effective_date: '2026-12-01' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: { data } }) });
  });
  await page.goto('http://desk.facturada.test/');
  await page.addScriptTag({ path: '/home/frappe/frappe-bench/apps/frappe/frappe/public/js/lib/jquery/jquery.min.js' });
  await page.evaluate(({ scheduled }) => {
    const w = window as any, $ = w.$;
    w.__ = (value: string, args: unknown[] = []) => value.replace(/\{(\d+)\}/g, (_: string, index: string) => String(args[Number(index)]));
    w.format_currency = (amount: number) => '$' + amount.toFixed(2);
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    const addDays = (value: string, days: number) => { const d = new Date(value); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
    w.frappe = {
      user: { has_role: () => true }, utils: { escape_html: (value: string) => $('<div>').text(value).html() },
      datetime: { get_today: () => '2026-11-10', str_to_user: (value: string) => value,
        get_diff: (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 86400000,
        add_days: addDays, add_months: (value: string, months: number) => { const d = new Date(value); d.setUTCMonth(d.getUTCMonth() + months); return iso(d); } },
      db: { get_list: async () => scheduled ? [{ name: 'SMV-TEST', status: 'Programado', movement_type: 'Renovación',
        effective_date: '2026-12-01', plan_name: 'Plan ficticio', amount: 0 }] : [] },
      call: async (options: any) => {
        const method = options.type || 'POST';
        const response = await fetch('/api/method/' + options.method, { method,
          ...(method === 'POST' ? { body: JSON.stringify(options.args || {}) } : {}) });
        if (!response.ok) throw new Error('Not permitted');
        return response.json();
      },
      msgprint: () => {}, show_alert: () => {}, set_route: () => {},
      confirm: (_: string, yes: () => void) => yes(),
      prompt: (_: any, action: any) => action({ reason: 'Cancelación de prueba' }),
      ui: { form: { on: (_: string, handlers: any) => w.handlers = handlers }, Dialog: class {
        wrapper = $('<div role="dialog">').appendTo('body');
        values: any = {}; fields: any = {};
        constructor(options: any) {
          w.dialog = this;
          for (const field of options.fields || []) {
            this.fields[field.fieldname] = { $wrapper: $('<div>').appendTo(this.wrapper), definition: field };
            if (!['HTML', 'Section Break', 'Column Break'].includes(field.fieldtype)) {
              const first = Array.isArray(field.options) ? field.options[0] : undefined;
              this.values[field.fieldname] = field.default ?? (typeof first === 'object' ? first?.value : first) ?? '';
            }
          }
          $('<button id="dialog-action">').text(options.primary_action_label)
            .on('click', () => options.primary_action({ ...this.values })).appendTo(this.wrapper);
        }
        get_value(key: string) { return this.values[key]; }
        set_values(values: any) { Object.assign(this.values, values); }
        get_field(key: string) { return this.fields[key]; }
        set_df_property() {} show() {} hide() { this.wrapper.remove(); }
      } },
    };
  }, { scheduled });
  await page.addScriptTag({ path: '/home/frappe/frappe-bench/apps/facturada_core/facturada_core/public/js/facturada_business_subscription.js' });
  await page.evaluate(async () => {
    const w = window as any, $ = w.$;
    const history = $('<div id="history">').appendTo('body');
    await w.handlers.refresh({ doc: { name: 'SUB-TEST', business: 'BUSINESS-TEST', status: 'Activo', plan_code: 'TEST',
      plan_name: 'Plan ficticio', subscription_start: '2026-11-01', subscription_end: '2026-11-30',
      quota_mode: 'Mixto', max_authorized_documents: 100, unlimited_documents: 0, max_users: 3, enable_billing: 1 },
      is_new: () => false, is_dirty: () => false, get_field: () => ({ $wrapper: history }),
      set_intro: (text: string) => $('<div id="intro">').html(text).appendTo('body'),
      reload_doc: () => w.reloaded = true,
      add_custom_button: (label: string, action: any) => $('<button>').text(label).on('click', action).appendTo('body') });
  });
  return calls;
}

for (const start of ['now', 'end']) {
  test(`Desk renueva ${start === 'now' ? 'hoy' : 'al terminar'}: catálogo GET y acción POST`, async ({ page }) => {
    const calls = await desk(page);
    await page.getByRole('button', { name: 'Renovar', exact: true }).click();
    await expect(page.locator('#dialog-action')).toBeVisible();
    expect(calls[0].method).toBe('GET');
    await page.evaluate(start => (window as any).dialog.set_values({ start, payment_reference: 'REF-TEST' }), start);
    await page.locator('#dialog-action').click();
    await expect.poll(() => page.evaluate(() => (window as any).reloaded)).toBe(true);
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toContain('renew_subscription');
    expect(calls[1].body).toMatchObject({ business: 'BUSINESS-TEST', plan_code: 'TEST', start,
      months: 1, max_authorized_documents: 100, amount: 15, payment_reference: 'REF-TEST' });
  });
}

test('Desk cambia plan conservando cupo y vigencia por POST', async ({ page }) => {
  const calls = await desk(page);
  await page.getByRole('button', { name: 'Cambiar plan (misma vigencia)', exact: true }).click();
  await expect(page.locator('#dialog-action')).toBeVisible();
  await page.evaluate(() => (window as any).dialog.set_values({ plan_code: 'RESTO_BASICO' }));
  await page.locator('#dialog-action').click();
  await expect.poll(() => page.evaluate(() => (window as any).reloaded)).toBe(true);
  expect(calls[0].method).toBe('GET');
  expect(calls[1].method).toBe('POST');
  expect(calls[1].url).toContain('change_plan');
  expect(calls[1].body).toMatchObject({ business: 'BUSINESS-TEST', plan_code: 'RESTO_BASICO', max_authorized_documents: 100 });
});

test('Desk muestra el programado y permite anularlo con motivo por POST', async ({ page }) => {
  const calls = await desk(page, true);
  await expect(page.locator('#history')).toContainText('Renovación · Programado');
  await expect(page.locator('#intro')).toContainText('Programado:');
  await page.getByRole('button', { name: 'Anular cambio programado', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).reloaded)).toBe(true);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].url).toContain('cancel_scheduled_movement');
  expect(calls[0].body).toEqual({ movement: 'SMV-TEST', reason: 'Cancelación de prueba' });
});
