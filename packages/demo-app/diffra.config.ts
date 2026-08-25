import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  driver: 'url',
  storybookUrl: 'http://localhost:3000',
  urls: [
    {
      url: '/',
      name: 'Landing Page',
      group: 'Marketing',
      delay: 150,
      diffThreshold: 0.05,
    },
    {
      url: '/#dashboard',
      name: 'Analytics Dashboard',
      group: 'Application',
      selector: '#dashboard-section',
      mask: ['.timestamp-badge'],
      delay: 150,
    },
  ],
  projects: [
    {
      name: 'desktop-chrome',
      browser: 'chromium',
      use: {
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      },
    },
    {
      name: 'mobile-safari',
      browser: 'webkit',
      use: {
        viewport: { width: 375, height: 667 },
        colorScheme: 'light',
      },
    },
  ],
});
