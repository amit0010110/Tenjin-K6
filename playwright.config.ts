import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'DATABASE_URL="file:./dev.db" npm run dev',
      port: 5173,
      workingDirectory: 'packages/frontend',
      reuseExistingServer: true,
    },
    {
      command: 'DATABASE_URL="file:./dev.db" npm run dev',
      port: 3001,
      workingDirectory: 'packages/backend',
      reuseExistingServer: true,
    },
  ],
});
