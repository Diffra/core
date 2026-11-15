import type { Page } from 'playwright';
import {
  type CaptureOptions,
  type CaptureTask,
  runCaptures,
} from '../capture/screenshot-runner.js';
import type { DiffEngineAdapter } from '../types/index.js';
import type { Cause, Explanation, Proof } from './explain.js';

/** Page loads one proof may use: the causes together, then each one alone. */
export const PROVE_MAX_CAPTURES = 6;

/** Undoes one cause: the styles of one element, by its path in the ledger. */
interface Revert {
  path: string;
  properties: Record<string, string>;
}

export interface ProveInput {
  explanation: Explanation;
  /** The selector the snapshot is of, from the ledger. */
  root?: string;
  /** The approved image that the pixels have to return to. */
  baselineImage: Buffer;
  /** How the snapshot is captured. The page is loaded again in the same way. */
  task: Pick<CaptureTask, 'target' | 'viewport' | 'project'>;
  diffEngine: DiffEngineAdapter;
  /** Perceptual threshold of the comparison. */
  threshold: number;
  capture: Pick<CaptureOptions, 'delay' | 'pauseAnimationAtEnd' | 'cwd'>;
  maxCaptures?: number;
}

/** What is run in the page: finds each element again and puts its old styles back. */
async function undoInPage(
  page: Page,
  root: string | undefined,
  reverts: Revert[],
): Promise<number> {
  return page.evaluate(
    async (args) => {
      const start = args.root
        ? document.querySelector(args.root)
        : document.documentElement;
      let missing = 0;
      for (const revert of args.reverts) {
        let cursor: Element | null | undefined = start;
        for (const segment of revert.path.split('>').slice(1)) {
          const match = /^([a-z0-9-]+)(?::(\d+))?$/.exec(segment);
          if (!cursor || !match) {
            cursor = null;
            break;
          }
          const [, tag, position] = match;
          cursor = Array.from(cursor.children).filter(
            (child) => child.tagName.toLowerCase() === tag,
          )[(position ? Number(position) : 1) - 1];
        }
        if (!(cursor instanceof HTMLElement)) {
          missing++;
          continue;
        }
        for (const [property, value] of Object.entries(revert.properties)) {
          cursor.style.setProperty(property, value, 'important');
        }
      }
      // Let layout settle before the screenshot.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return missing;
    },
    { root, reverts },
  );
}

function revertFor(cause: Cause): Revert | undefined {
  if (cause.changes.length === 0) return undefined;
  return {
    path: cause.element.path,
    properties: Object.fromEntries(
      cause.changes.map((change) => [change.property, change.before]),
    ),
  };
}

/** Whether undoing this cause's styles is all it takes to undo the cause. */
function fullyUndoable(cause: Cause): boolean {
  return (
    cause.changes.length > 0 &&
    !cause.textChange &&
    !cause.appeared &&
    !cause.disappeared
  );
}

/**
 * Tests the causes of a change in the live page. The page is loaded again as it
 * is now, each cause is undone, and the screenshot is compared with the
 * approved baseline. If the pixels match again, the change is proven to come
 * from those causes. Where several causes were found, each one is also undone
 * alone, and is proven only if that alone restores the baseline.
 */
export async function proveExplanation(
  input: ProveInput,
): Promise<Explanation> {
  const { explanation } = input;
  const reverts = explanation.causes
    .map((cause) => ({ cause, revert: revertFor(cause) }))
    .filter(
      (entry): entry is { cause: Cause; revert: Revert } =>
        entry.revert !== undefined,
    );
  let captures = input.maxCaptures ?? PROVE_MAX_CAPTURES;

  if (reverts.length === 0) {
    return withProof(explanation, {
      status: 'not-attempted',
      reverted: 0,
      note: 'No style change in the page was found to undo. A change of text, or of which elements are present, cannot be undone by Diffra.',
    });
  }

  /** Loads the page with the given causes undone and counts the changed regions left. */
  const regionsLeft = async (
    undo: Revert[],
  ): Promise<{ remaining: number; missing: number }> => {
    captures--;
    let missing = 0;
    const { results, failures } = await runCaptures(
      [
        {
          ...input.task,
          prepare: async (page) => {
            missing = await undoInPage(page, input.root, undo);
          },
        },
      ],
      undefined,
      {
        concurrency: 1,
        attempts: 1,
        ledger: false,
        ...input.capture,
      },
    );
    const [captured] = results;
    if (!captured) {
      throw new Error(
        failures[0]?.error ?? 'The page could not be loaded again.',
      );
    }
    const diff = await input.diffEngine.compare(
      input.baselineImage,
      captured.buffer,
      {
        threshold: input.threshold,
        diffThreshold: input.threshold,
        generateDiffImage: false,
      },
    );
    return { remaining: diff.hasDiff ? diff.boundingBoxes.length : 0, missing };
  };

  const together = await regionsLeft(reverts.map((entry) => entry.revert));
  const allUndoable =
    reverts.length === explanation.causes.length &&
    reverts.every((entry) => fullyUndoable(entry.cause));

  if (together.missing > 0) {
    return withProof(explanation, {
      status: 'unproven',
      reverted: reverts.length,
      note: `${together.missing} changed ${together.missing === 1 ? 'element' : 'elements'} could not be found again in the page, so the changes could not be undone.`,
    });
  }
  if (together.remaining > 0) {
    return withProof(explanation, {
      status: 'unproven',
      reverted: reverts.length,
      remainingRegions: together.remaining,
      note: `Undoing the style ${reverts.length === 1 ? 'change' : 'changes'} found did not restore the baseline: ${together.remaining} changed ${together.remaining === 1 ? 'area remains' : 'areas remain'}.${allUndoable ? '' : ' Some changes, such as text or added elements, cannot be undone by Diffra.'}`,
    });
  }

  // Together they restore the baseline. Find out which restore it alone.
  const proven = new Set<Cause>();
  if (reverts.length === 1) {
    proven.add(reverts[0]?.cause as Cause);
  } else {
    for (const entry of reverts) {
      if (captures <= 0) break;
      const alone = await regionsLeft([entry.revert]);
      if (alone.missing === 0 && alone.remaining === 0) proven.add(entry.cause);
    }
  }

  const causes = explanation.causes.map((cause) =>
    proven.has(cause) ? { ...cause, confidence: 'proven' as const } : cause,
  );
  const only = reverts.length === 1;
  return withProof(
    { ...explanation, causes },
    {
      status: 'proven',
      reverted: reverts.length,
      note: only
        ? 'Undoing this change in the page restored the baseline.'
        : proven.size > 0
          ? `Undoing the changes together restored the baseline, and undoing ${proven.size === 1 ? 'one of them' : `${proven.size} of them`} alone did too.`
          : 'Undoing the changes together restored the baseline, but none of them alone did.',
    },
  );
}

function withProof(explanation: Explanation, proof: Proof): Explanation {
  const sentence =
    proof.status === 'proven'
      ? ' Proven: undoing it restored the baseline.'
      : proof.status === 'unproven'
        ? ' Not proven: undoing it did not restore the baseline.'
        : '';
  return {
    ...explanation,
    summary: `${explanation.summary.replace(/ (Proven|Not proven): .*$/, '')}${sentence}`,
    proof,
  };
}
