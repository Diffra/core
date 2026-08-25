# Testing web applications and routes

Diffra's URL driver enables automated visual regression testing for full web applications, server-rendered routes (Next.js App Router, Remix, Nuxt, Astro, SvelteKit), static marketing sites, and client-side single page applications (Vite, React, Vue).

---

## Configuration overview

To test web application routes, set `driver: 'url'` in your `diffra.config.ts`:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  driver: 'url',

  // Base URL for relative paths
  storybookUrl: 'http://localhost:3000',

  // List of route strings or target objects
  urls: [
    '/',
    '/pricing',
    '/features',
    {
      url: '/dashboard',
      name: 'Analytics Dashboard',
      group: 'Authenticated Pages',
      selector: '#dashboard-grid',
      delay: 250,
      diffThreshold: 0.05,
      mask: ['.dynamic-clock', '.user-avatar'],
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'desktop', width: 1440, height: 900 },
      ],
    },
  ],

  // Global responsive viewports
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
});
```

---

## Route target options

Each entry in the `urls` array can be a plain relative path string (e.g. `'/pricing'`) or a detailed `UrlTargetConfig` object:

| Property | Type | Description |
| :--- | :--- | :--- |
| `url` | `string` | **Required**. Relative path (`'/checkout'`) or absolute URL (`'https://staging.example.com/checkout'`). |
| `name` | `string` | Human-readable target name displayed in reports and sidebar. |
| `group` | `string` | Categorization group in the review viewer sidebar (e.g. `'Marketing Pages'`). |
| `selector` | `string` | CSS selector to isolate for capture (e.g. `'#pricing-cards'`). Ignores the rest of the page. |
| `mask` | `string[]` | CSS selectors for dynamic elements to mask (e.g. `['.live-counter', '.auth-email']`). |
| `delay` | `number` | Milliseconds to wait after page load before taking screenshot. Useful for client-side hydration. |
| `diffThreshold` | `number` | Perceptual sensitivity threshold (`0.00` strict to `1.00` permissive) for this specific route. |
| `viewports` | `(number \| Viewport)[]` | Specific viewport dimensions to test for this route. |

---

## Common web application patterns

### 1. Element isolation with selectors
Instead of capturing an entire viewport that may contain dynamic external ads or footers, isolate the specific container:

```typescript
{
  url: '/pricing',
  name: 'Pricing Comparison Table',
  selector: '#comparison-table',
}
```

### 2. Client-side hydration delays
For server-rendered applications (Next.js, Remix, Astro) where interactive JavaScript hydration occurs asynchronously after HTML delivery:

```typescript
{
  url: '/interactive-calculator',
  name: 'ROI Calculator',
  delay: 300, // Allow 300ms for React hydration and charting libraries to initialize
}
```

### 3. Dynamic content masking
Web applications often display timestamps, randomized session tokens, or user avatars that cause false-positive visual diffs. Mask them with CSS selectors:

```typescript
{
  url: '/account/billing',
  name: 'Billing Invoices',
  mask: [
    '.invoice-date',
    '.transaction-id',
    '#current-timestamp',
  ],
}
```

---

## Testing production vs preview deployments

You can pass the base URL dynamically from the CLI to test preview deployments (e.g. Vercel, Netlify, Cloudflare Pages preview URLs):

```bash
diffra test --driver url --url https://pr-123.preview.myapp.com --urls "/,/pricing,/docs"
```
