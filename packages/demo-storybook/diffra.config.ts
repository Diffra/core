import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  drivers: 'storybook',
  snapshot: {
    diffThreshold: 0.08,
    delay: 150,
    // The showcase screens are laid out for a desktop browser window.
    viewports: [{ name: 'desktop', width: 1280, height: 800 }],
  },
  runner: {
    concurrency: 4,
  },
  storage: {
    provider: 'local',
    dir: '.diffra/baselines',
  },
});
