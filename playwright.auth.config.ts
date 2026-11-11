import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests-e2e',
  testMatch: 'auth-current.e2e.spec.ts',
  workers: 1,
  reporter: 'list',
  outputDir: '/tmp/facturada-2026-11-11-final-auth',
  use: {
    baseURL: 'http://127.0.0.1:4228',
    browserName: 'chromium',
    serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 960 }, colorScheme: 'light' } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 900 }, colorScheme: 'light' } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, colorScheme: 'light' } },
    { name: 'mobile-dark', use: { viewport: { width: 390, height: 844 }, colorScheme: 'dark' } },
  ],
  webServer: {
    command:
      'python3 tests-e2e/serve-isolated-app.py --directory /tmp/facturada-2026-11-11-final-production/browser --port 4228',
    url: 'http://127.0.0.1:4228/portal/auth/sign-in',
    reuseExistingServer: false,
  },
});
