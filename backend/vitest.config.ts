import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Each test starts its own embedded Postgres, which is slow on a busy machine.
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
