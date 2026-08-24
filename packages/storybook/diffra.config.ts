import { defineConfig } from '@diffra/core';

export default defineConfig({
  storybookUrl: 'http://localhost:6006',
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
  threshold: 0.08,
  delay: 150,
  concurrency: 4,
  baselineBranch: 'origin/main',
  storage: {
    type: 'local',
    local: {
      baselineDir: '.diffra/baselines',
    },
  },
});
