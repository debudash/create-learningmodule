import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the running stack: web on :3000, collab on :1234 and
 * the worker, all with LLM_MODE=fake, on a freshly seeded database (pnpm db:reset).
 * See docs/test_plan.md.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', viewport: { width: 1450, height: 1000 }, screenshot: 'only-on-failure' },
});
