import type { Page } from 'playwright';

/** Version of the ledger shape, raised when a field is removed or changes meaning. */
export const LEDGER_SCHEMA_VERSION = 1;

/** Elements recorded per snapshot. A page with more is cut off and marked. */
export const MAX_LEDGER_ELEMENTS = 800;

/** Longest own text recorded for an element. */
export const MAX_LEDGER_TEXT = 80;

/** Most stylesheet rules recorded for one element. */
export const MAX_RULES_PER_ELEMENT = 12;

/** Origin recorded for a rule from a stylesheet that has no address. */
export const INLINE_ORIGIN = 'inline';

/**
 * The computed properties that change how an element looks. Anything outside
 * this list cannot explain a visual difference, so it is not recorded.
 */
export const VISUAL_STYLE_PROPERTIES = [
  'display',
  'position',
  'visibility',
  'opacity',
  'overflow-x',
  'overflow-y',
  'z-index',
  'transform',
  'width',
  'height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-style',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'box-shadow',
  'color',
  'background-color',
  'background-image',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration-line',
  'text-transform',
  'white-space',
  'gap',
  'flex-direction',
  'justify-content',
  'align-items',
] as const;

/** Name of the stored document that holds the ledger of an image. */
export function ledgerDocumentName(imageHash: string): string {
  return `ledger-${imageHash}.json`;
}

export interface LedgerBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A stylesheet rule that matches an element and sets some visual properties. */
export interface LedgerRule {
  selector: string;
  /** Address or build id of the stylesheet, or INLINE_ORIGIN. */
  origin: string;
  /** Only the visual properties the rule sets, as written. */
  declarations: Record<string, string>;
}

export interface LedgerElement {
  /** Position in the document, such as "body>div:1>button:2". Stable between runs of the same page. */
  path: string;
  tag: string;
  id?: string;
  classes?: string[];
  /** The element's own text, shortened. */
  text?: string;
  /** In the pixel space of the screenshot. */
  box: LedgerBox;
  styles: Record<string, string>;
  rules: LedgerRule[];
}

/** What was on the page when a snapshot was taken: the context a pixel diff lacks. */
export interface RenderLedger {
  schemaVersion: number;
  viewport: { width: number; height: number };
  elements: LedgerElement[];
  /** Font families that were loaded. */
  fonts: string[];
  /** True when the page had more elements than were recorded. */
  truncated: boolean;
  /** The selector of the element the snapshot is of, when it is not the whole page. Element paths start there. */
  root?: string;
}

export interface LedgerOptions {
  /** The element that was screenshotted, when the snapshot is of one element. */
  selector?: string;
  /** Whether the screenshot covers the whole scrollable page. */
  fullPage?: boolean;
}

interface PageArguments {
  selector?: string;
  fullPage: boolean;
  maxElements: number;
  maxText: number;
  maxRules: number;
  inlineOrigin: string;
  properties: readonly string[];
}

/**
 * Runs inside the page, so it can use nothing from this module. It is passed
 * to the browser as source text, and everything it needs arrives as arguments.
 */
function collectInPage(
  args: PageArguments,
): Omit<RenderLedger, 'schemaVersion' | 'viewport'> {
  const root: Element =
    (args.selector ? document.querySelector(args.selector) : null) ??
    document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const originX = args.selector
    ? rootRect.left
    : args.fullPage
      ? -window.scrollX
      : 0;
  const originY = args.selector
    ? rootRect.top
    : args.fullPage
      ? -window.scrollY
      : 0;

  const skipped = new Set([
    'HEAD',
    'SCRIPT',
    'STYLE',
    'LINK',
    'META',
    'NOSCRIPT',
  ]);
  const all = [root, ...Array.from(root.querySelectorAll('*'))].filter(
    (el) => !skipped.has(el.tagName),
  );

  const indexByElement = new Map<Element, number>();
  const elements: Array<{
    element: Element;
    path: string;
    box: { x: number; y: number; width: number; height: number };
  }> = [];
  let truncated = false;

  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== root.parentElement) {
      const parent: Element | null = node.parentElement;
      const sameTag = parent
        ? Array.from(parent.children).filter((c) => c.tagName === node?.tagName)
        : [];
      const position = parent ? sameTag.indexOf(node) + 1 : 1;
      parts.unshift(
        `${node.tagName.toLowerCase()}${sameTag.length > 1 ? `:${position}` : ''}`,
      );
      node = parent;
    }
    return parts.join('>');
  };

  for (const element of all) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === 'none') continue;
    if (elements.length >= args.maxElements) {
      truncated = true;
      break;
    }
    indexByElement.set(element, elements.length);
    elements.push({
      element,
      path: pathOf(element),
      box: {
        x: Math.round((rect.left - originX) * 100) / 100,
        y: Math.round((rect.top - originY) * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      },
    });
  }

  const rulesByIndex = new Map<
    number,
    Array<{
      selector: string;
      origin: string;
      declarations: Record<string, string>;
    }>
  >();

  const originOf = (sheet: CSSStyleSheet): string => {
    if (sheet.href) {
      try {
        return new URL(sheet.href).pathname;
      } catch {
        return sheet.href;
      }
    }
    const owner = sheet.ownerNode as Element | null;
    return (
      owner?.getAttribute('data-vite-dev-id') ??
      owner?.getAttribute('data-href') ??
      args.inlineOrigin
    );
  };

  const visit = (rules: CSSRuleList, origin: string) => {
    for (const rule of Array.from(rules)) {
      const styleRule = rule as CSSStyleRule;
      if (styleRule.selectorText && styleRule.style) {
        const declarations: Record<string, string> = {};
        for (const property of args.properties) {
          const value = styleRule.style.getPropertyValue(property);
          if (value) declarations[property] = value;
        }
        if (Object.keys(declarations).length === 0) continue;
        let matched: Element[] = [];
        try {
          matched = [
            ...(root.matches(styleRule.selectorText) ? [root] : []),
            ...Array.from(root.querySelectorAll(styleRule.selectorText)),
          ];
        } catch {
          continue;
        }
        for (const el of matched) {
          const index = indexByElement.get(el);
          if (index === undefined) continue;
          const list = rulesByIndex.get(index) ?? [];
          list.push({ selector: styleRule.selectorText, origin, declarations });
          rulesByIndex.set(index, list);
        }
        continue;
      }
      const grouping = rule as CSSGroupingRule;
      if (!grouping.cssRules) continue;
      const media = (rule as CSSMediaRule).media;
      if (media && !window.matchMedia(media.mediaText).matches) continue;
      const condition = (rule as CSSSupportsRule).conditionText;
      if (condition !== undefined && !media && !CSS.supports(condition)) {
        continue;
      }
      visit(grouping.cssRules, origin);
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, originOf(sheet));
    } catch {
      // A stylesheet from another origin cannot be read.
    }
  }

  return {
    elements: elements.map((entry, index) => {
      const el = entry.element;
      const computed = getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const property of args.properties) {
        styles[property] = computed.getPropertyValue(property);
      }
      const ownText = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, args.maxText);
      return {
        path: entry.path,
        tag: el.tagName.toLowerCase(),
        ...(el.id ? { id: el.id } : {}),
        ...(el.classList.length > 0
          ? { classes: Array.from(el.classList) }
          : {}),
        ...(ownText ? { text: ownText } : {}),
        box: entry.box,
        styles,
        rules: (rulesByIndex.get(index) ?? []).slice(-args.maxRules),
      };
    }),
    fonts: Array.from(document.fonts)
      .filter((font) => font.status === 'loaded')
      .map((font) => font.family.replace(/^"|"$/g, '')),
    truncated,
    ...(args.selector && document.querySelector(args.selector)
      ? { root: args.selector }
      : {}),
  };
}

/** Records what is on the page, in the pixel space of the snapshot being taken. */
export async function captureLedger(
  page: Pick<Page, 'evaluate' | 'viewportSize'>,
  options: LedgerOptions = {},
): Promise<RenderLedger> {
  const collected = await page.evaluate(collectInPage, {
    selector: options.selector,
    fullPage: options.fullPage ?? false,
    maxElements: MAX_LEDGER_ELEMENTS,
    maxText: MAX_LEDGER_TEXT,
    maxRules: MAX_RULES_PER_ELEMENT,
    inlineOrigin: INLINE_ORIGIN,
    properties: VISUAL_STYLE_PROPERTIES,
  });
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  return { schemaVersion: LEDGER_SCHEMA_VERSION, viewport, ...collected };
}
