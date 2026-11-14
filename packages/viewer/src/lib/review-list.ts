import type { TestResult, TestStatus } from '../types/index.js';
import {
  compareStatus,
  needsReview,
  STATUS_LABEL,
  STATUS_ORDER,
} from './status.js';

export interface ReviewGroup {
  component: string;
  items: TestResult[];
}

/** `review` is everything that needs a decision. */
export type ReviewFilter = 'review' | TestStatus;

export const FILTER_LABEL: Record<ReviewFilter, string> = {
  review: 'To review',
  ...STATUS_LABEL,
};

export interface ReviewListOptions {
  query: string;
  filter: ReviewFilter;
}

function matchesFilter(status: TestStatus, filter: ReviewFilter): boolean {
  return filter === 'review' ? needsReview(status) : status === filter;
}

/** The filters worth offering: only statuses that exist in this run. */
export function availableFilters(
  results: readonly TestResult[],
): ReviewFilter[] {
  const present = new Set(results.map((r) => r.status));
  return ['review', ...STATUS_ORDER.filter((s) => present.has(s))];
}

const collator = new Intl.Collator(undefined, { numeric: true });

function compareItems(a: TestResult, b: TestResult): number {
  return (
    compareStatus(a.status, b.status) ||
    collator.compare(a.name, b.name) ||
    collator.compare(a.viewport.name, b.viewport.name)
  );
}

/**
 * Groups snapshots by component for the sidebar. Groups with the most urgent
 * snapshot come first, and so do snapshots inside a group.
 */
export function buildReviewList(
  results: readonly TestResult[],
  { query, filter }: ReviewListOptions,
): ReviewGroup[] {
  const needle = query.trim().toLowerCase();
  const groups = new Map<string, TestResult[]>();

  for (const result of results) {
    if (!matchesFilter(result.status, filter)) continue;
    if (
      needle &&
      !result.name.toLowerCase().includes(needle) &&
      !result.component.toLowerCase().includes(needle)
    ) {
      continue;
    }
    const list = groups.get(result.component) ?? [];
    list.push(result);
    groups.set(result.component, list);
  }

  return Array.from(groups, ([component, items]) => ({
    component,
    items: items.sort(compareItems),
  })).sort(
    (a, b) =>
      compareStatus(
        a.items[0]?.status ?? 'unchanged',
        b.items[0]?.status ?? 'unchanged',
      ) || collator.compare(a.component, b.component),
  );
}

/** The snapshots in the order the sidebar shows them. */
export function flattenGroups(groups: readonly ReviewGroup[]): TestResult[] {
  return groups.flatMap((group) => group.items);
}

export function countByStatus(
  results: readonly TestResult[],
): Record<TestStatus, number> {
  const counts: Record<TestStatus, number> = {
    failed: 0,
    changed: 0,
    removed: 0,
    added: 0,
    unchanged: 0,
  };
  for (const result of results) {
    counts[result.status] += 1;
  }
  return counts;
}

const SUMMARY_ORDER: readonly TestStatus[] = [
  'failed',
  'changed',
  'added',
  'removed',
];

/** A short sentence for the run, for example "2 changed, 1 new". */
export function describeRun(results: readonly TestResult[]): string {
  const counts = countByStatus(results);
  const parts = SUMMARY_ORDER.filter((status) => counts[status] > 0).map(
    (status) => `${counts[status]} ${STATUS_LABEL[status].toLowerCase()}`,
  );
  return parts.length > 0 ? parts.join(', ') : 'No visual changes';
}
