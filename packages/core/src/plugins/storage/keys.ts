import type { SnapshotKey } from '../../types/index.js';

/** Name of the file listing the snapshots promoted for a commit. */
export const BASELINE_KEYS_FILE = 'manifest.json';

export function serializeKeys(keys: SnapshotKey[]): string {
  return JSON.stringify({ snapshots: keys }, null, 2);
}

/** Reads a stored list of snapshots, or null when it is not a valid list. */
export function parseKeys(raw: string | Buffer): SnapshotKey[] | null {
  try {
    const parsed: unknown = JSON.parse(raw.toString());
    const list =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { snapshots?: unknown }).snapshots
        : undefined;
    if (!Array.isArray(list)) return null;
    return list.filter(
      (k): k is SnapshotKey =>
        typeof k === 'object' &&
        k !== null &&
        typeof (k as SnapshotKey).targetId === 'string' &&
        typeof (k as SnapshotKey).viewport?.width === 'number' &&
        typeof (k as SnapshotKey).viewport?.height === 'number',
    );
  } catch {
    return null;
  }
}
