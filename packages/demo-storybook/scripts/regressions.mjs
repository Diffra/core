/**
 * Introduces, or removes, one realistic regression in each screen.
 *
 * Every change is a single line of the kind that ships by accident in a real
 * pull request: a renamed design token, a typo in a unit, a dropped style. Run
 * it on a scratch branch, then run Diffra to see how each one is reported:
 *
 *   node scripts/regressions.mjs apply
 *   node scripts/regressions.mjs revert
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..');

/** One entry per screen: what breaks, how, and what a reviewer then sees. */
export const REGRESSIONS = [
  {
    screen: 'Checkout',
    cause: 'A design token was renamed, so the pay button loses its colour.',
    file: 'src/screens/Checkout/CheckoutPage.tsx',
    from: "const PAY_BUTTON_BACKGROUND = 'var(--brand-500)';",
    to: "const PAY_BUTTON_BACKGROUND = 'var(--color-brand-primary)';",
  },
  {
    screen: 'Landing page',
    cause: 'The hero image path changed and the file no longer exists.',
    file: 'src/screens/Landing/LandingPage.tsx',
    from: 'const HERO_IMAGE = dashboardPreview();',
    to: "const HERO_IMAGE = 'assets/hero-dashboard-v2.png';",
  },
  {
    screen: 'Pricing',
    cause: 'An API field was renamed, so every price renders as NaN.',
    file: 'src/screens/Pricing/PricingPage.tsx',
    from: 'plan.monthly',
    to: 'plan.monthlyPrice',
  },
  {
    screen: 'Dashboard',
    cause:
      'A layout refactor dropped the sidebar offset, so content slides under it.',
    file: 'src/screens/Dashboard/DashboardPage.tsx',
    from: 'marginLeft: SIDEBAR_WIDTH,',
    to: 'marginLeft: 0,',
  },
  {
    screen: 'Sign in',
    cause:
      'A hard-coded colour replaced a theme token, so dark mode text vanishes.',
    file: 'src/screens/SignIn/SignInPage.tsx',
    from: "const FORM_TEXT = 'var(--ink-900)';",
    to: "const FORM_TEXT = '#0f172a';",
  },
  {
    screen: 'Team invite',
    cause:
      'The overlay lost its positioning, so the modal drops below the page.',
    file: 'src/screens/TeamInvite/TeamInvitePage.tsx',
    from: "const OVERLAY_POSITION = { position: 'absolute', inset: 0 } as const;",
    to: "const OVERLAY_POSITION = { position: 'static' } as const;",
  },
  {
    screen: 'Mobile shop',
    cause: 'No-wrap was added for truncation, which pushes buttons off screen.',
    file: 'src/screens/MobileShop/MobileShopScreen.tsx',
    from: "const TITLE_WRAP = 'normal' as const;",
    to: "const TITLE_WRAP = 'nowrap' as const;",
  },
  {
    screen: 'Product catalog',
    cause: 'The grid template was simplified and collapsed to a single column.',
    file: 'src/screens/Catalog/ProductCatalogPage.tsx',
    from: "const GRID_COLUMNS = 'repeat(3, minmax(0, 1fr))';",
    to: "const GRID_COLUMNS = '1fr';",
  },
  {
    screen: 'Hotel search',
    cause:
      'The card now clips overflow, so the date picker is cut off entirely.',
    file: 'src/screens/HotelSearch/HotelSearchPage.tsx',
    from: "const SEARCH_CARD_OVERFLOW = 'visible' as const;",
    to: "const SEARCH_CARD_OVERFLOW = 'hidden' as const;",
  },
  {
    screen: 'Bank transfer',
    cause: 'A state default flipped, so the loading overlay never goes away.',
    file: 'src/screens/Transfer/TransferPage.tsx',
    from: 'const INITIALLY_PROCESSING = false;',
    to: 'const INITIALLY_PROCESSING = true;',
  },
  {
    screen: 'Analytics',
    cause:
      'A data field was renamed, the chart threw, and an error screen replaced the report.',
    file: 'src/screens/Analytics/AnalyticsPage.tsx',
    from: 'const points = report.series;',
    to: 'const points = report.timeseries;',
  },
  {
    screen: 'Blog',
    cause: 'A unit typo set line height to 1.75px, so lines of text overlap.',
    file: 'src/screens/Article/ArticlePage.tsx',
    from: 'const BODY_LINE_HEIGHT = 1.75;',
    to: "const BODY_LINE_HEIGHT = '1.75px';",
  },
];

/** Applies or reverts every regression under root. Returns how many changed. */
export function run(mode, root = PACKAGE_ROOT) {
  // Plan every edit first, so a missing anchor never leaves a half-applied set.
  const planned = REGRESSIONS.map((regression) => {
    const [before, after] =
      mode === 'apply'
        ? [regression.from, regression.to]
        : [regression.to, regression.from];
    const target = path.join(root, regression.file);
    const source = fs.readFileSync(target, 'utf8');
    if (!source.includes(before)) {
      const state = source.includes(after) ? 'already' : 'not found in';
      throw new Error(
        `${regression.screen}: ${mode} ${state} ${regression.file}`,
      );
    }
    return { regression, target, next: source.replaceAll(before, after) };
  });

  for (const { regression, target, next } of planned) {
    fs.writeFileSync(target, next);
    console.log(
      `${mode === 'apply' ? 'broke   ' : 'restored'} ${regression.screen}: ${regression.cause}`,
    );
  }
  return planned.length;
}

if (import.meta.filename === process.argv[1]) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { root: { type: 'string' } },
  });
  const mode = positionals[0];
  if (mode === 'apply' || mode === 'revert') {
    try {
      run(mode, values.root ? path.resolve(values.root) : PACKAGE_ROOT);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  } else {
    console.error('Usage: regressions.mjs <apply|revert> [--root <dir>]');
    process.exitCode = 1;
  }
}
