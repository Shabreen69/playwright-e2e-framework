import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — multi-browser, multi-viewport, parallel execution.
 * Supports local, CI (headless), and staging environments.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'results/junit.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://staging.olaelectric.com',
    headless: !!process.env.CI,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // ── Desktop browsers ────────────────────────────────────────
    {
      name: 'Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Safari',
      use: { ...devices['Desktop Safari'] },
    },
    // ── Mobile viewports ────────────────────────────────────────
    {
      name: 'Mobile Chrome (Android)',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari (iOS)',
      use: { ...devices['iPhone 14'] },
    },
    // ── Smoke suite — Chrome only, fast feedback ─────────────────
    {
      name: 'Smoke',
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.START_SERVER ? {
    command: 'npm run start:staging',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  } : undefined,
});
