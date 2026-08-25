# Custom drivers and lifecycle plugins

Diffra provides a modular architecture allowing downstream teams to supply custom target discovery, custom screenshot capture engines, and lifecycle plugins.

---

## 1. Custom visual drivers (`VisualDriver`)

Implement `VisualDriver` to integrate custom testing frameworks (Cypress, Puppeteer, Selenium), mobile web viewports, or custom headless rendering pipelines:

```typescript
import { defineConfig } from '@diffra/core/config';
import type { DriverCaptureTask, DriverContext, VisualDriver, VisualTarget } from '@diffra/core';

export const customE2EDriver: VisualDriver = {
  name: 'custom-e2e-driver',

  async setup(context: DriverContext) {
    // Start local server or initialize external driver process
  },

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    return [
      {
        id: 'checkout--payment-modal',
        name: 'Payment Modal',
        group: 'Checkout Flows',
        parameters: {
          snapshot: { diffThreshold: 0.04 },
        },
      },
    ];
  },

  async capture(task: DriverCaptureTask, context: DriverContext): Promise<Buffer | null> {
    // Execute custom capture returning PNG image Buffer
    return await myCustomCaptureUtility(task.target.id, task.viewport);
  },

  async teardown(context: DriverContext) {
    // Teardown background servers or driver instances
  },
};

export default defineConfig({
  driver: customE2EDriver,
});
```

---

## 2. Test lifecycle plugins (`DiffraPlugin`)

Plugins hook into every stage of the test runner lifecycle:

```typescript
import { defineConfig } from '@diffra/core/config';
import type { DiffraPlugin, TestRunReport, Viewport, VisualTarget } from '@diffra/core';

const customAuditPlugin: DiffraPlugin = {
  name: 'custom-audit-plugin',

  async setup(config) {
    console.log('Diffra runner initializing...');
  },

  async onDiscoverStories(stories: VisualTarget[]) {
    // Filter or dynamically modify discovered targets
    return stories.filter((story) => !story.filePath?.includes('draft'));
  },

  async onBeforeCapture(target: VisualTarget, viewport: Viewport) {
    // Hook called before each screenshot
  },

  async onAfterCapture(target: VisualTarget, viewport: Viewport, buffer: Buffer) {
    // Transform or inspect captured image buffer
    return buffer;
  },

  async onTestComplete(report: TestRunReport) {
    console.log(`Test completed with ${report.summary.changed} visual regressions.`);
  },
};

export default defineConfig({
  plugins: [customAuditPlugin],
});
```
