import type { TestStatus } from '../types/index.js';

/** Words shown to the reviewer. "Added" reads better as "New". */
export const STATUS_LABEL: Record<TestStatus, string> = {
  failed: 'Failed',
  changed: 'Changed',
  removed: 'Removed',
  added: 'New',
  unchanged: 'Unchanged',
};

/** Most urgent first: what most needs a human decision is listed first. */
export const STATUS_ORDER: readonly TestStatus[] = [
  'failed',
  'changed',
  'removed',
  'added',
  'unchanged',
];

export function compareStatus(a: TestStatus, b: TestStatus): number {
  return STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b);
}

/** Unchanged snapshots need no decision, so they are hidden by default. */
export function needsReview(status: TestStatus): boolean {
  return status !== 'unchanged';
}
