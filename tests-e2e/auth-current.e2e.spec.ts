import { test, expect, Page } from '@playwright/test';

const businesses = [
  { name: 'B-ONE', business_name: 'Tienda de prueba' },
  { name: 'B-TWO', business_name: 'Café de prueba' },
];
async function isolate(page: Page, dark: boolean, multiple = false) {
  let loginCalls = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ dark }) => {
      localStorage.clear();
      localStorage.setItem(
        'theme',
        JSON.stringify({ mode: dark ? 'dark' : 'light', color: 'facturada', direction: 'ltr' }),
      );
      localStorage.setItem('logo', 'https://must-not-load.invalid/other-business.png');
    },
    { dark },
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/socket.io/')) return route.abort();
    if (!url.pathname.startsWith('/api/'))
      return url.origin === 'http://127.0.0.1:4228' ? route.continue() : route.abort();
    if (!['http://127.0.0.1:4228', 'https://facturada.bmarc-corp.com'].includes(url.origin)) return route.abort();
    // The production build uses an absolute API URL; fulfill it locally, never continue it.
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4228',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/method/login')) {
      loginCalls++;
      return route.fulfill({
        headers,
        status: multiple ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(multiple ? { message: 'Logged In' } : { message: 'Invalid login' }),
      });
    }
    if (url.pathname.includes('get_businesses'))
      return route.fulfill({
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ message: { data: businesses } }),
      });
    return route.fulfill({
      headers,
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ exc_type: 'PermissionError', message: 'No access to test business' }),
    });
  });
  return { calls: () => loginCalls, errors };
}

test('login adaptable, validación, contraseña y ayuda accesible', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark');
  await page.goto('/portal/auth/sign-in');
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
  await expect(page.locator('aside.auth-brand')).toBeVisible({ visible: page.viewportSize()!.width >= 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Escribe tu usuario o correo.', { exact: true })).toBeVisible();
  expect(state.calls()).toBe(0);
  await page.getByLabel('Contraseña', { exact: true }).fill('solo-pruebas');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page.locator('#forgot-help')).toContainText('administrador');
  expect(state.errors).toEqual([]);
  await expect(page.locator('img[src*="must-not-load"]')).toHaveCount(0);
  await page.screenshot({ path: `/tmp/facturada-auth-${info.project.name}.png`, fullPage: true });
});

test('credenciales incorrectas muestran error local y se limpia al editar', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark');
  await page.goto('/portal/auth/sign-in');
  await page.getByLabel('Usuario o correo').fill('usuario@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('solo-pruebas');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El usuario o la contraseña no son correctos.');
  expect(state.calls()).toBe(1);
  await page.getByLabel('Usuario o correo').fill('otro@example.com');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('varios negocios y rechazo de acceso mantienen selector disponible', async ({ page }, info) => {
  const state = await isolate(page, info.project.name === 'mobile-dark', true);
  await page.goto('/portal/auth/sign-in');
  await page.getByLabel('Usuario o correo').fill('usuario@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('solo-pruebas');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Elige el negocio' })).toBeVisible();
  await page.getByRole('button', { name: 'Tienda de prueba' }).click();
  await expect(page.getByRole('alert')).toContainText('No tienes acceso a ese negocio. Elige otro.');
  await expect(page.getByRole('button', { name: 'Café de prueba' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('active_business'))).toBeNull();
  expect(state.errors).toEqual([]);
});

test('ruta de recuperación retirada lleva al login de marca', async ({ page }, info) => {
  await isolate(page, info.project.name === 'mobile-dark');
  await page.goto('/portal/auth/forgot-password');
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
});
