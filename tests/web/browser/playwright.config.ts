import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  use: {
    baseURL: 'http://127.0.0.1:3103',
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 3103 --strictPort',
    cwd: '../../..',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: !process.env.CI,
  },
})
