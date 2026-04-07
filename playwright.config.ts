import { defineConfig } from '@playwright/test';

const headed = process.env.HEADED === 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1, // séquentiel pour éviter les conflits de données entre tests
  use: {
    baseURL: 'http://localhost',
    screenshot: 'on',
    video: 'off',
    headless: !headed,
    slowMo: headed ? 600 : 0,
    locale: 'fr-FR',
  },
  outputDir: './e2e/screenshots',
  reporter: [['line'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
});
