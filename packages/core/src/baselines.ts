import type { SnapshotKey, StorageAdapter } from './types/index.js';

export interface BaselineResolver {
  find(key: SnapshotKey): Promise<Buffer | null>;
  /** The commit whose baseline was used, once any snapshot has been found */
  resolvedCommit(): string | undefined;
}

/** Identifies a snapshot across runs: target, browser and viewport size. */
export function snapshotId(key: SnapshotKey): string {
  return `${key.targetId}|${key.browser ?? ''}|${key.viewport.width}x${key.viewport.height}`;
}

/**
 * Looks up the baseline image for a snapshot across a list of commits, newest
 * first. Once any snapshot resolves at a commit, later lookups try that commit
 * first, since baselines are promoted for a whole run at once.
 */
export function createBaselineResolver(
  storage: StorageAdapter,
  commits: string[],
): BaselineResolver {
  let resolvedCommit: string | undefined;

  return {
    resolvedCommit: () => resolvedCommit,
    async find(key) {
      const ordered = resolvedCommit
        ? [resolvedCommit, ...commits.filter((c) => c !== resolvedCommit)]
        : commits;
      for (const commit of ordered) {
        const buffer = await storage.downloadBaseline(commit, key);
        if (buffer) {
          resolvedCommit = commit;
          return buffer;
        }
      }
      return null;
    },
  };
}
