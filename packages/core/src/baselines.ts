import type { SnapshotKey, StorageAdapter } from './types/index.js';

export interface BaselineResolver {
  find(key: SnapshotKey): Promise<Buffer | null>;
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
