import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// Suite A is read-only against a LIVE production Google Sheets backend (see
// customer-detail-tabs.spec.ts header comment). Run everything serially, in
// one worker, so we never fire concurrent requests at the live backend and so
// screenshot numbering stays deterministic.
export default defineConfig({
  testDir: here,
  globalSetup: path.join(here, 'global-setup.ts'),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3102',
    channel: 'chrome',
    headless: true,
    // This is a staff MOBILE app (sm:max-w-[390px] app shell). Default to a
    // real mobile viewport; the "Desktop viewport comparison" describe block
    // overrides this to 1280x800 for the side-by-side comparison shots.
    viewport: { width: 390, height: 844 },
    trace: 'off',
    video: 'off',
    screenshot: 'off', // we take explicit, named screenshots ourselves
  },
});
