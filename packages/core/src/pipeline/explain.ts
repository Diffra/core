import type { BoundingBox } from '@diffra/engine';
import type {
  LedgerBox,
  LedgerElement,
  RenderLedger,
} from '../context/ledger.js';

/** Boxes that moved by less than this many pixels are treated as not moved. */
export const BOX_EPSILON = 0.5;

/**
 * Properties that change how much room an element takes. A change to one of
 * these can push other elements around, which the explanation attributes to it.
 */
const LAYOUT_PROPERTIES = new Set([
  'display',
  'position',
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
  'font-size',
  'font-family',
  'font-weight',
  'line-height',
  'letter-spacing',
  'white-space',
  'text-transform',
  'gap',
  'flex-direction',
]);

/**
 * Properties whose computed value is the size the element ended up with. They
 * change whenever content or a neighbour changes, so a change counts as a cause
 * only when a stylesheet rule sets the property on that element.
 */
const SIZE_PROPERTIES = new Set(['width', 'height']);

function declaresProperty(element: LedgerElement, property: string): boolean {
  return element.rules.some((rule) => property in rule.declarations);
}

/** Properties that are written per side, and the shorthand they are described as. */
export const SIDE_FAMILIES: [string, string[]][] = [
  [
    'padding',
    ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  ],
  ['margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']],
  [
    'border-width',
    [
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
    ],
  ],
  [
    'border-radius',
    [
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-right-radius',
      'border-bottom-left-radius',
    ],
  ],
];

export interface PropertyChange {
  property: string;
  before: string;
  after: string;
}

export interface CauseElement {
  path: string;
  tag: string;
  id?: string;
  classes?: string[];
  text?: string;
}

export interface CauseSource {
  /** The stylesheet that sets the changed property. */
  origin: string;
  selector: string;
  /** Whether that file differs from the baseline commit, when that is known. */
  inBranch?: boolean;
}

/** One change in the page that lines up with changed pixels. */
export interface Cause {
  element: CauseElement;
  /** Changed styles. Empty when the element only moved or resized. */
  changes: PropertyChange[];
  textChange?: { before?: string; after?: string };
  appeared?: boolean;
  disappeared?: boolean;
  source?: CauseSource;
  /** How many other elements moved or resized because of this one. */
  displaced: number;
  /**
   * How well established the cause is. Attributed means a change in the page
   * lines up with the pixels. Proven means that undoing this change alone, in
   * the live page, made the pixels match the baseline again.
   */
  confidence: 'attributed' | 'proven';
}

/** The outcome of undoing the causes in the live page and comparing again. */
export interface Proof {
  /**
   * `proven`: undoing the changes restored the baseline. `unproven`: it did
   * not, or the changes could not all be found again. `not-attempted`: none of
   * the changes can be undone by Diffra.
   */
  status: 'proven' | 'unproven' | 'not-attempted';
  /** In words, what was done and what it showed. */
  note: string;
  /** How many causes were undone. */
  reverted: number;
  /** Changed regions that remained after undoing them, when it did not restore the baseline. */
  remainingRegions?: number;
}

export interface RegionExplanation {
  index: number;
  box: BoundingBox;
  /** Indexes into the causes of the explanation. Empty when nothing accounts for the region. */
  causes: number[];
}

/** What changed in the page, and which changed pixels it accounts for. */
export interface Explanation {
  /** One plain sentence. */
  summary: string;
  causes: Cause[];
  regions: RegionExplanation[];
  /** Present once the causes were tested in the live page. */
  proof?: Proof;
}

export interface ExplainInput {
  baseline: RenderLedger;
  candidate: RenderLedger;
  /** The changed regions of the pixel diff. */
  regions: BoundingBox[];
  /** Files that differ from the baseline commit, relative to the project. */
  changedFiles?: string[];
}

interface Footprint extends LedgerBox {}

function boxesDiffer(a: LedgerBox, b: LedgerBox): boolean {
  return (
    Math.abs(a.x - b.x) > BOX_EPSILON ||
    Math.abs(a.y - b.y) > BOX_EPSILON ||
    Math.abs(a.width - b.width) > BOX_EPSILON ||
    Math.abs(a.height - b.height) > BOX_EPSILON
  );
}

function intersects(box: Footprint, region: BoundingBox): boolean {
  return (
    box.x <= region.maxX + 1 &&
    box.x + box.width >= region.minX &&
    box.y <= region.maxY + 1 &&
    box.y + box.height >= region.minY
  );
}

function isAncestor(ancestor: string, descendant: string): boolean {
  return descendant.startsWith(`${ancestor}>`);
}

function describeElement(element: LedgerElement): CauseElement {
  return {
    path: element.path,
    tag: element.tag,
    ...(element.id ? { id: element.id } : {}),
    ...(element.classes ? { classes: element.classes } : {}),
    ...(element.text ? { text: element.text } : {}),
  };
}

/** The file name a stylesheet origin points at, without query or leading slash. */
function originFile(origin: string): string {
  return origin.split('?')[0]?.replace(/^\/+/, '') ?? origin;
}

/** Whether a stylesheet origin is one of the files that differ from the baseline. */
export function matchesChangedFile(
  origin: string,
  changedFiles: string[],
): boolean {
  const file = originFile(origin);
  if (!file) return false;
  return changedFiles.some((changed) => {
    const normalized = changed.replace(/^\.?\/+/, '');
    return (
      normalized === file ||
      normalized.endsWith(`/${file}`) ||
      file.endsWith(`/${normalized}`)
    );
  });
}

function findSource(
  candidate: LedgerElement,
  changes: PropertyChange[],
  changedFiles: string[] | undefined,
): CauseSource | undefined {
  const changed = new Set(changes.map((c) => c.property));
  for (const rule of [...candidate.rules].reverse()) {
    if (Object.keys(rule.declarations).some((p) => changed.has(p))) {
      return {
        origin: rule.origin,
        selector: rule.selector,
        ...(changedFiles
          ? { inBranch: matchesChangedFile(rule.origin, changedFiles) }
          : {}),
      };
    }
  }
  return undefined;
}

interface Entry {
  cause: Cause;
  /** Where the changed element was and is, which the pixels can be matched to. */
  footprint: Footprint[];
  affectsLayout: boolean;
}

/**
 * Compares what was on the page before and after, and says which changes
 * account for the changed pixels. Every cause is attributed, not proven: a
 * change in the page lines up with the pixels, which is strong evidence but
 * not a demonstration.
 */
export function explainChange(input: ExplainInput): Explanation {
  const before = new Map(input.baseline.elements.map((e) => [e.path, e]));
  const after = new Map(input.candidate.elements.map((e) => [e.path, e]));
  const order = [
    ...input.candidate.elements.map((e) => e.path),
    ...input.baseline.elements
      .map((e) => e.path)
      .filter((path) => !after.has(path)),
  ];

  const entries: Entry[] = [];
  const movedOnly: Array<{ element: LedgerElement; footprint: Footprint[] }> =
    [];

  for (const path of order) {
    const was = before.get(path);
    const now = after.get(path);
    const element = (now ?? was) as LedgerElement;

    if (!was || !now) {
      entries.push({
        cause: {
          element: describeElement(element),
          changes: [],
          ...(now ? { appeared: true } : { disappeared: true }),
          displaced: 0,
          confidence: 'attributed',
        },
        footprint: [element.box],
        affectsLayout: true,
      });
      continue;
    }

    const changes: PropertyChange[] = [];
    for (const [property, value] of Object.entries(now.styles)) {
      const previous = was.styles[property];
      if (
        SIZE_PROPERTIES.has(property) &&
        !declaresProperty(now, property) &&
        !declaresProperty(was, property)
      ) {
        continue;
      }
      if (previous !== undefined && previous !== value) {
        changes.push({ property, before: previous, after: value });
      }
    }
    const textChanged = (was.text ?? '') !== (now.text ?? '');
    const footprint = [was.box, now.box];

    if (changes.length > 0 || textChanged) {
      entries.push({
        cause: {
          element: describeElement(now),
          changes,
          ...(textChanged
            ? { textChange: { before: was.text, after: now.text } }
            : {}),
          source: findSource(now, changes, input.changedFiles),
          displaced: 0,
          confidence: 'attributed',
        },
        footprint,
        affectsLayout:
          textChanged || changes.some((c) => LAYOUT_PROPERTIES.has(c.property)),
      });
    } else if (boxesDiffer(was.box, now.box)) {
      movedOnly.push({ element: now, footprint });
    }
  }

  // An element that only moved or resized was pushed by something else. Find
  // what: the nearest container that changed, then the nearest content inside
  // it that changed, then the closest change before it in the document.
  for (const moved of movedOnly) {
    const path = moved.element.path;
    const layoutEntries = entries.filter((e) => e.affectsLayout);
    const root =
      layoutEntries
        .filter((e) => isAncestor(e.cause.element.path, path))
        .sort(
          (a, b) => b.cause.element.path.length - a.cause.element.path.length,
        )[0] ??
      layoutEntries
        .filter((e) => isAncestor(path, e.cause.element.path))
        .sort(
          (a, b) => a.cause.element.path.length - b.cause.element.path.length,
        )[0] ??
      [...layoutEntries]
        .reverse()
        .find((e) => order.indexOf(e.cause.element.path) < order.indexOf(path));

    if (root) {
      root.cause.displaced++;
      // The box of a container says little about where its content changed.
      if (!isAncestor(path, root.cause.element.path)) {
        root.footprint.push(...moved.footprint);
      }
    } else {
      entries.push({
        cause: {
          element: describeElement(moved.element),
          changes: [],
          displaced: 0,
          confidence: 'attributed',
        },
        footprint: moved.footprint,
        affectsLayout: false,
      });
    }
  }

  const causes = entries.map((e) => e.cause);
  const regions: RegionExplanation[] = input.regions.map((box, index) => ({
    index,
    box,
    causes: entries
      .map((entry, causeIndex) =>
        entry.footprint.some((f) => intersects(f, box)) ? causeIndex : -1,
      )
      .filter((causeIndex) => causeIndex >= 0),
  }));

  return { summary: summarize(causes, regions), causes, regions };
}

function elementLabel(element: CauseElement): string {
  const classes = element.classes?.length ? `.${element.classes[0]}` : '';
  return `${element.tag}${element.id ? `#${element.id}` : classes}`;
}

/** Describes style changes, folding the four sides of padding, margin and so on into one. */
export function describeStyleChanges(changes: PropertyChange[]): string {
  const remaining = new Map(changes.map((c) => [c.property, c]));
  const parts: string[] = [];
  for (const [family, sides] of SIDE_FAMILIES) {
    const members = sides
      .map((side) => remaining.get(side))
      .filter((c): c is PropertyChange => c !== undefined);
    const [first] = members;
    if (
      first &&
      members.every((m) => m.before === first.before && m.after === first.after)
    ) {
      parts.push(`${family} ${first.before} to ${first.after}`);
      for (const side of sides) remaining.delete(side);
    }
  }
  for (const change of remaining.values()) {
    parts.push(`${change.property} ${change.before} to ${change.after}`);
  }
  return parts.join(', ');
}

function describeCause(cause: Cause): string {
  const label = elementLabel(cause.element);
  if (cause.appeared) return `${label} was added`;
  if (cause.disappeared) return `${label} was removed`;
  const parts: string[] = [];
  if (cause.changes.length > 0) parts.push(describeStyleChanges(cause.changes));
  if (cause.textChange) {
    parts.push(
      `text changed from "${cause.textChange.before ?? ''}" to "${cause.textChange.after ?? ''}"`,
    );
  }
  if (parts.length === 0) return `${label} moved or changed size`;
  const where = cause.source
    ? ` (${originFile(cause.source.origin)} ${cause.source.selector}${cause.source.inBranch ? ', changed in this branch' : ''})`
    : '';
  return `${label}: ${parts.join('; ')}${where}`;
}

function summarize(causes: Cause[], regions: RegionExplanation[]): string {
  const unexplained = regions.filter((r) => r.causes.length === 0).length;
  const unexplainedNote =
    unexplained > 0
      ? ` ${unexplained} changed ${unexplained === 1 ? 'area has' : 'areas have'} no matching change in the page, which points to an image, a canvas or a rendering difference.`
      : '';
  const [main, ...others] = [...causes].sort(
    (a, b) => b.displaced - a.displaced,
  );
  if (!main) {
    return `No change in the page accounts for the changed pixels.${unexplainedNote}`;
  }
  const moved =
    main.displaced > 0
      ? ` ${main.displaced} other ${main.displaced === 1 ? 'element' : 'elements'} moved as a result.`
      : '';
  const more =
    others.length > 0
      ? ` ${others.length} other ${others.length === 1 ? 'change' : 'changes'} in the page.`
      : '';
  return `${describeCause(main)}.${moved}${more}${unexplainedNote}`;
}
