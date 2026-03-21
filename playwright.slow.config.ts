import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 120000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    launchOptions: { slowMo: 400 },
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
