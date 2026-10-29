import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e', testMatch: 'company-migration.e2e.spec.ts', workers: 1,
  reporter: 'list', outputDir: '/tmp/facturada-migration-playwright',
  use: {
    baseURL: 'http://127.0.0.1:4218', browserName: 'chromium', serviceWorkers: 'block',
    testIdAttribute: 'data-test-id',
    launchOptions: { executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  webServer: {
    command: 'python3 tests-e2e/serve-built-app.py --directory /tmp/facturada-legacy-build/browser --port 4218',
    url: 'http://127.0.0.1:4218/portal/', reuseExistingServer: false,
  },
});
