import { test, expect } from '@playwright/test';

test('Desk consulta catálogo por GET y aplica el plan por POST', async ({ page }) => {
  const calls: { method: string; url: string; body: any }[] = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!url.includes('/api/')) return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    calls.push({ method: request.method(), url, body: request.postDataJSON() });
    const catalog = url.endsWith('get_plan_catalog');
    if (request.method() !== (catalog ? 'GET' : 'POST')) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"exception":"Not permitted"}' });
    const data = catalog ? [{ code: 'RESTO_BASICO', name: 'Restaurante Básico', description: 'Plan de prueba', modules: { enable_billing: 1, enable_restaurant: 1 } }]
      : { subscription: 'SUB-TEST', plan_code: 'RESTO_BASICO' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: { data } }) });
  });
  await page.goto('http://desk.facturada.test/');
  await page.addScriptTag({ path: '/home/frappe/frappe-bench/apps/frappe/frappe/public/js/lib/jquery/jquery.min.js' });
  await page.evaluate(() => {
    const w = window as any, $ = w.$;
    w.__ = (value: string) => value;
    w.frappe = {
      user: { has_role: () => true }, utils: { escape_html: (value: string) => $('<div>').text(value).html() },
      call: async (options: any) => {
        const method = options.type || 'POST';
        const response = await fetch('/api/method/' + options.method, { method, ...(method === 'POST' ? { body: JSON.stringify(options.args || {}) } : {}) });
        if (!response.ok) throw new Error('Not permitted');
        return response.json();
      },
      msgprint: () => {}, show_alert: () => {},
      ui: { form: { on: (_: string, handlers: any) => w.handlers = handlers }, Dialog: class {
        wrapper = $('<div>').appendTo('body');
        constructor(options: any) {
          $('<button id="apply-plan">').text(options.primary_action_label).on('click', () => options.primary_action({ plan_code: 'RESTO_BASICO' })).appendTo(this.wrapper);
        }
        show() {} hide() { this.wrapper.remove(); }
      } },
    };
  });
  await page.addScriptTag({ path: '/home/frappe/frappe-bench/apps/facturada_core/facturada_core/public/js/facturada_business_subscription.js' });
  await page.evaluate(() => {
    const w = window as any;
    w.handlers.refresh({ doc: { business: 'BUSINESS-TEST' }, is_new: () => false, is_dirty: () => false,
      set_intro: () => {}, reload_doc: () => w.reloaded = true,
      add_custom_button: (label: string, action: any) => w.$('<button id="choose-plan">').text(label).on('click', action).appendTo('body') });
  });
  await page.locator('#choose-plan').click();
  await expect(page.locator('#apply-plan')).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('GET');
  await page.locator('#apply-plan').click();
  await expect.poll(() => page.evaluate(() => (window as any).reloaded)).toBe(true);
  expect(calls[1].method).toBe('POST');
  expect(calls[1].body).toEqual({ business: 'BUSINESS-TEST', plan_code: 'RESTO_BASICO' });
});
