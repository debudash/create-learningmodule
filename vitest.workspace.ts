import { defineWorkspace } from 'vitest/config';

// Unit tests run anywhere; integration tests need the Compose Postgres (DATABASE_URL).
export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
      exclude: ['**/*.int.test.ts', '**/node_modules/**'],
    },
  },
  {
    test: {
      name: 'integration',
      include: ['packages/*/src/**/*.int.test.ts', 'apps/*/src/**/*.int.test.ts'],
      testTimeout: 30_000,
    },
  },
]);
