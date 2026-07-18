import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 15000,
  retries: 0,
  use: {
    // Dedicated test port — avoids colliding with other Vite apps on 5173
    baseURL: 'http://localhost:5193',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 5000,
  },
  webServer: {
    command: 'npx vite --port 5193 --strictPort',
    port: 5193,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
