import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Many tests drive a real Chromium, which can take several seconds on a
    // busy machine or in CI. The default of five seconds is too tight for them.
    testTimeout: 30_000,
  },
});
