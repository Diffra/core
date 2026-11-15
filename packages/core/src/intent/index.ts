import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { matchesChangedFile } from '../pipeline/explain.js';
import { matchesFilter } from '../pipeline/plan.js';
import type { TestRunSummary, VisualTestResult } from '../types/index.js';

/** Version of the intent file shape. */
export const INTENT_SCHEMA_VERSION = 1;

/** Where declared intents are kept, relative to the project, unless configured. */
export const DEFAULT_INTENT_FILE = '.diffra/intent.json';

export type IntentAuthor = 'human' | 'agent';

/**
 * A statement of what a change is meant to alter. A snapshot is intended when
 * it is named by `targets`, or when every cause of its change is in one of the
 * `sources` or matches one of the `selectors`.
 */
export interface Intent {
  id: string;
  /** What should change, in words. */
  description: string;
  /** Snapshots expected to change: an id, or text in a name or group. */
  targets?: string[];
  /** Stylesheets the change is expected to come from, such as `src/button.css`. */
  sources?: string[];
  /** Rule selectors the change is expected to come from, such as `.btn`. */
  selectors?: string[];
  author: IntentAuthor;
  createdAt: string;
}

export type NewIntent = Omit<Intent, 'id' | 'createdAt' | 'author'> & {
  author?: IntentAuthor;
};

interface IntentFile {
  schemaVersion: number;
  intents: Intent[];
}

/** Whether a change was declared beforehand. */
export type ChangeKind = 'intended' | 'collateral';

export interface Classification {
  kind: ChangeKind;
  /** The intent that covers the change, when it is intended. */
  intent?: string;
  /** In words, why the change was classified this way. */
  reason: string;
}

const CLASSIFIED_STATUSES = new Set(['changed', 'added', 'removed']);

function isIntent(value: unknown): value is Intent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.description === 'string'
  );
}

/** Reads the declared intents. A missing file means none were declared. */
export async function readIntents(file: string): Promise<Intent[]> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON.`);
  }
  const intents = (parsed as Partial<IntentFile>)?.intents;
  if (!Array.isArray(intents) || !intents.every(isIntent)) {
    throw new Error(`${file} is not a Diffra intent file.`);
  }
  return intents;
}

async function writeIntents(file: string, intents: Intent[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const content: IntentFile = { schemaVersion: INTENT_SCHEMA_VERSION, intents };
  await fs.writeFile(file, `${JSON.stringify(content, null, 2)}\n`, 'utf-8');
}

function cleaned(values: string[] | undefined): string[] | undefined {
  const kept = values?.map((v) => v.trim()).filter(Boolean);
  return kept && kept.length > 0 ? kept : undefined;
}

/**
 * Builds an intent from what was declared. An intent needs words that say what it is
 * and at least one scope, since an intent that covers everything covers nothing.
 */
export function createIntent(input: NewIntent): Intent {
  const description = input.description?.trim();
  if (!description) throw new Error('An intent needs a description.');
  const targets = cleaned(input.targets);
  const sources = cleaned(input.sources);
  const selectors = cleaned(input.selectors);
  if (!targets && !sources && !selectors) {
    throw new Error(
      'An intent needs at least one of targets, sources or selectors, so that it says what it covers.',
    );
  }
  const intent: Intent = {
    id: `intent-${crypto.randomUUID().slice(0, 8)}`,
    description,
    ...(targets ? { targets } : {}),
    ...(sources ? { sources } : {}),
    ...(selectors ? { selectors } : {}),
    author: input.author ?? 'human',
    createdAt: new Date().toISOString(),
  };
  return intent;
}

/** Declares an intent and keeps it in the intent file. */
export async function addIntent(
  file: string,
  input: NewIntent,
): Promise<Intent> {
  const intent = createIntent(input);
  await writeIntents(file, [...(await readIntents(file)), intent]);
  return intent;
}

/** Removes every declared intent, or only the given ones. */
export async function clearIntents(
  file: string,
  ids?: string[],
): Promise<number> {
  const existing = await readIntents(file);
  const kept = ids ? existing.filter((i) => !ids.includes(i.id)) : [];
  await writeIntents(file, kept);
  return existing.length - kept.length;
}

/** Says whether an intent covers a change, and if not, what is left over. */
function cover(
  result: VisualTestResult,
  intent: Intent,
): { covered: boolean; why: string } {
  const named = intent.targets?.find((pattern) =>
    matchesFilter(
      { id: result.id, name: result.name, group: result.group },
      pattern,
    ),
  );
  if (named) {
    return { covered: true, why: `it is named by "${named}"` };
  }

  if (!intent.sources && !intent.selectors) {
    return { covered: false, why: 'it is not one of the declared targets' };
  }
  const { explanation } = result;
  if (!explanation || explanation.causes.length === 0) {
    return {
      covered: false,
      why: 'it is not a declared target and there is no explanation to check against the declared sources',
    };
  }
  const unaccounted = explanation.regions.filter((r) => r.causes.length === 0);
  if (unaccounted.length > 0) {
    return {
      covered: false,
      why: `${unaccounted.length} changed ${unaccounted.length === 1 ? 'area is' : 'areas are'} not accounted for by any change in the page`,
    };
  }
  const outside = explanation.causes.filter(
    (cause) =>
      !cause.source ||
      !(
        (intent.sources &&
          matchesChangedFile(cause.source.origin, intent.sources)) ||
        intent.selectors?.includes(cause.source.selector)
      ),
  );
  if (outside.length > 0) {
    const [first] = outside;
    const label = first
      ? `${first.element.tag}${first.element.id ? `#${first.element.id}` : ''}`
      : 'an element';
    return {
      covered: false,
      why: `the change to ${label} does not come from a declared source${outside.length > 1 ? ` (and ${outside.length - 1} more)` : ''}`,
    };
  }
  return {
    covered: true,
    why: 'every change in the page comes from a declared source',
  };
}

/**
 * Judges each change against the declared intents. With no intents nothing is
 * judged: a run that was not given a purpose has no collateral.
 */
export function classifyResults(
  results: VisualTestResult[],
  intents: Intent[],
): VisualTestResult[] {
  if (intents.length === 0) return results;
  return results.map((result) => {
    if (!CLASSIFIED_STATUSES.has(result.status)) return result;
    let leftOver = 'no intent was declared for it';
    for (const intent of intents) {
      const verdict = cover(result, intent);
      if (verdict.covered) {
        return {
          ...result,
          classification: {
            kind: 'intended',
            intent: intent.id,
            reason: `${intent.description}: ${verdict.why}`,
          },
        };
      }
      leftOver = verdict.why;
    }
    return {
      ...result,
      classification: {
        kind: 'collateral',
        reason: `Not covered by a declared intent: ${leftOver}.`,
      },
    };
  });
}

/** Counts of intended and collateral changes, present only when intents were declared. */
export function countClassifications(
  results: VisualTestResult[],
): Pick<TestRunSummary, 'intended' | 'collateral'> | undefined {
  const classified = results.filter((r) => r.classification);
  if (classified.length === 0) return undefined;
  const count = (kind: ChangeKind) =>
    classified.filter((r) => r.classification?.kind === kind).length;
  return { intended: count('intended'), collateral: count('collateral') };
}
