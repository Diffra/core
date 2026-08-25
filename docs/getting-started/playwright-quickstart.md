# Playwright test runner quickstart

Diffra provides first-class visual baseline assertions for Playwright test runners via `@diffra/core/playwright`.

---

## Step 1: Install dependencies

Install Diffra alongside `@playwright/test`:

```bash
pnpm add -D @diffra/core @diffra/engine
```

---

## Step 2: Register custom matcher

Extend Playwright's `expect` matcher with `toMatchVisualBaselineMatcher` in your test setup or directly inside your test files:

```typescript
import { expect, test } from '@playwright/test';
import { toMatchVisualBaselineMatcher } from '@diffra/core/playwright';

// Register Diffra's custom visual baseline matcher
expect.extend({
  toMatchVisualBaseline: toMatchVisualBaselineMatcher,
});
```

To enable TypeScript autocomplete for `toMatchVisualBaseline`, add the type definition to your `tsconfig.json` or test types file:

```typescript
declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toMatchVisualBaseline(
        snapshotId: string,
        options?: import('@diffra/core/playwright').VisualBaselineOptions,
      ): Promise<R>;
    }
  }
}
```

---

## Step 3: Write visual assertions

Use `toMatchVisualBaseline` on `Page` or `Locator` instances:

```typescript
import { expect, test } from '@playwright/test';
import { toMatchVisualBaselineMatcher } from '@diffra/core/playwright';

expect.extend({
  toMatchVisualBaseline: toMatchVisualBaselineMatcher,
});

test.describe('Landing page visual checks', () => {
  test('hero section matches baseline', async ({ page }) => {
    await page.goto('/');

    // Assert full page visual baseline
    await expect(page).toMatchVisualBaseline('landing-fullpage', {
      diffThreshold: 0.05,
    });

    // Assert specific isolated element with locator masking
    const heroCard = page.locator('.hero-card');
    await expect(heroCard).toMatchVisualBaseline('hero-card-widget', {
      mask: [page.locator('.dynamic-clock'), page.locator('.user-avatar')],
    });
  });
});
```

---

## Step 4: Run Playwright tests

Execute your Playwright test suite as normal:

```bash
pnpm playwright test
```

Diffra automatically manages baseline discovery, merge-base Git commits, CAS fast-path matching, and generates diff artifacts on visual mismatches.

---

## Next steps

* Learn about locator masking, clip regions, and diff thresholds in [Playwright matcher integration](../guides/playwright-integration.md).
* Configure cloud storage backends for CI in [Storage adapters](../storage-and-plugins/storage-adapters.md).
