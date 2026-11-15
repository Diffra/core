import type { TestRunReport } from '../types/index.js';

/**
 * What a run fails on. `any` fails on every changed snapshot. `collateral`
 * fails only on changes that no declared intent covers.
 */
export type Gate = 'any' | 'collateral';

export const DEFAULT_GATE: Gate = 'any';

/**
 * How many changed snapshots need a person's decision. Gating on collateral
 * changes needs intents to have been declared; without any, every change
 * still counts, so the gate cannot pass a run by default.
 */
export function decisionsNeeded(
  report: Pick<TestRunReport, 'summary' | 'gate'>,
): number {
  const { summary, gate } = report;
  if (gate === 'collateral' && summary.collateral !== undefined) {
    return summary.collateral;
  }
  return summary.changed;
}
