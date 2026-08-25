# Playwright matcher integration

Diffra exposes `@diffra/core/playwright` to seamlessly embed visual baseline testing directly inside existing Playwright E2E and component test suites.

---

## Setup and matcher registration

Register the custom matcher by extending Playwright's `expect`:

```typescript
// playwright.setup.ts or inside test file
import { expect } from '@playwright/test';
import { toMatchVisualBaselineMatcher } from '@diffra/core/playwright';

expect.extend({
  toMatchVisualBaseline: toMatchVisualBaselineMatcher,
});
```

---

## Visual assertions API

The `toMatchVisualBaseline` matcher accepts a unique snapshot ID and an optional options object:

```typescript
await expect(pageOrLocator).toMatchVisualBaseline(snapshotId, options);
```

### Options reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `diffThreshold` / `threshold` | `number` | `0.063` | Perceptual sensitivity threshold (`0.0` strict to `1.0` permissive). |
| `mask` | `Locator[]` | `undefined` | Array of Playwright `Locator` instances to mask with pink placeholder boxes. |
| `fullPage` | `boolean` | `false` | When `true`, takes a screenshot of the entire scrollable page. |
| `clip` | `{ x, y, width, height }` | `undefined` | Specific clipping rectangular region to capture. |
| `omitBackground` | `boolean` | `false` | Hides default white background and captures transparent PNG. |
| `animations` | `'disabled' \| 'allow'` | `'disabled'` | Controls whether CSS animations are frozen during screenshot. |
| `screenshotOptions` | `PageScreenshotOptions` | `undefined` | Passthrough raw Playwright screenshot options. |

---

## Usage patterns

### 1. Full page snapshots
```typescript
import { expect, test } from '@playwright/test';

test('homepage renders without visual regressions', async ({ page }) => {
  await page.goto('/');
  await expect(page).toMatchVisualBaseline('home-page-desktop', {
    fullPage: true,
  });
});
```

### 2. Isolated locator snapshots
Assert on specific DOM elements rather than full pages:

```typescript
test('navigation bar dropdown opens correctly', async ({ page }) => {
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: /products/i });
  await menuButton.click();

  const dropdown = page.locator('#products-flyout-menu');
  await expect(dropdown).toMatchVisualBaseline('nav-products-dropdown');
});
```

### 3. Dynamic element masking with Playwright Locators
Pass Playwright `Locator` objects to `mask` to automatically redact dynamic elements:

```typescript
test('user profile displays correct layout', async ({ page }) => {
  await page.goto('/profile');

  await expect(page).toMatchVisualBaseline('user-profile-card', {
    mask: [
      page.locator('.user-avatar-image'),
      page.locator('.member-since-date'),
      page.locator('.notification-count-badge'),
    ],
  });
});
```

### 4. Multi-device and multi-browser matrix testing
Because Diffra uses standard Playwright context and device options, your visual assertions automatically inherit the active browser (`chromium`, `firefox`, `webkit`) and viewport size from your `playwright.config.ts`.
