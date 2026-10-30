import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests-e2e', testMatch: ['desk-migration.spec.ts', 'desk-cleanup.spec.ts', 'desk-plans.spec.ts'], workers: 1,
  reporter: 'list', outputDir: '/tmp/facturada-desk-migration-playwright',
  use: { browserName: 'chromium', serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
});
