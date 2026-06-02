import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  workers: 1, // run serially — tests share DB state

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    // Cookies persist within a test, cleared between tests via storageState
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer — you start frontend + backend manually
})