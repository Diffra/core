import { type Browser, chromium, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  captureLedger,
  INLINE_ORIGIN,
  LEDGER_SCHEMA_VERSION,
  MAX_LEDGER_ELEMENTS,
} from '../../src/context/ledger.js';

const HTML = `<!doctype html><html><head>
<style data-vite-dev-id="/src/button.css">
  .btn { padding: 8px 16px; color: rgb(200, 0, 0); }
  .btn:hover { color: blue; }
  @media (min-width: 100000px) { .btn { padding: 99px; } }
</style>
<style>#card { margin: 20px; width: 200px; }</style>
</head><body style="margin:0">
<div id="card"><button class="btn primary" id="go">Go ahead</button><span hidden>gone</span></div>
</body></html>`;

describe('captureLedger', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await page.setContent(HTML);
  });

  afterAll(async () => {
    await browser.close();
  });

  it('records each visible element with its box, styles and text', async () => {
    const ledger = await captureLedger(page);
    expect(ledger).toMatchObject({
      schemaVersion: LEDGER_SCHEMA_VERSION,
      viewport: { width: 400, height: 300 },
      truncated: false,
    });
    const button = ledger.elements.find((e) => e.id === 'go');
    expect(button).toMatchObject({
      tag: 'button',
      classes: ['btn', 'primary'],
      text: 'Go ahead',
      path: 'html>body>div>button',
    });
    expect(button?.box.width).toBeGreaterThan(0);
    expect(button?.styles['padding-left']).toBe('16px');
    expect(button?.styles.color).toBe('rgb(200, 0, 0)');
  });

  it('leaves out elements that are not displayed', async () => {
    const ledger = await captureLedger(page);
    expect(ledger.elements.some((e) => e.tag === 'span')).toBe(false);
    expect(ledger.elements.some((e) => e.tag === 'style')).toBe(false);
  });

  it('attributes styles to the stylesheet and selector that set them', async () => {
    const ledger = await captureLedger(page);
    const button = ledger.elements.find((e) => e.id === 'go');
    expect(button?.rules).toContainEqual({
      selector: '.btn',
      origin: '/src/button.css',
      declarations: {
        'padding-top': '8px',
        'padding-right': '16px',
        'padding-bottom': '8px',
        'padding-left': '16px',
        color: 'rgb(200, 0, 0)',
      },
    });
    // The media query does not apply at this width, and :hover is not matched.
    expect(button?.rules).toHaveLength(1);
    const card = ledger.elements.find((e) => e.id === 'card');
    expect(card?.rules[0]?.origin).toBe(INLINE_ORIGIN);
  });

  it('measures boxes from the origin of the element that was screenshotted', async () => {
    const ledger = await captureLedger(page, { selector: '#card' });
    const [first] = ledger.elements;
    expect(first?.id).toBe('card');
    expect(first?.box).toMatchObject({ x: 0, y: 0, width: 200 });
    const button = ledger.elements.find((e) => e.id === 'go');
    expect(button?.box.x).toBe(0);
  });

  it('cuts off a page with too many elements and says so', async () => {
    const crowded = await browser.newPage();
    await crowded.setContent(
      `<body>${'<i>x</i>'.repeat(MAX_LEDGER_ELEMENTS + 50)}</body>`,
    );
    const ledger = await captureLedger(crowded);
    expect(ledger.elements).toHaveLength(MAX_LEDGER_ELEMENTS);
    expect(ledger.truncated).toBe(true);
    await crowded.close();
  });
});
