import { defineConfig } from '@playwright/test';

/**
 * E2E regression suite for state-transition bugs that unit tests can't
 * catch (they're wiring/lifecycle gaps, not algorithm bugs) — see
 * tests/e2e/*.spec.ts. Runs against a real local dev server + local
 * MongoDB (see README "Getting Started" for the docker-compose setup);
 * never point MONGODB_URI at a real/production cluster while running
 * this suite, since it creates and mutates real sessions.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
