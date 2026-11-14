import { defineConfig } from 'vitest/config';

// Tests must not load vite.config.ts: that file builds the committed dist/
// bundle, and its plugins would run when the test process exits.
export default defineConfig({
  test: {
    // The bundle test builds the action and runs it against a real browser.
    testTimeout: 90_000,
  },
});
