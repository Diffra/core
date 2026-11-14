import type { DiffMode } from '../types/index.js';
import { DEFAULT_MODE, DIFF_MODES } from './constants.js';

export type Route =
  | { kind: 'overview' }
  | { kind: 'snapshot'; id: string; mode: DiffMode };

const STORY_PREFIX = 'story/';

function isDiffMode(value: string | undefined): value is DiffMode {
  return DIFF_MODES.some((mode) => mode === value);
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Reads the hash location. Snapshot links look like `/story/<id>/<mode>`, and
 * the mode is optional so older `/story/<id>` links keep working.
 */
export function parseRoute(
  location: string,
  hasSnapshot: (id: string) => boolean,
): Route {
  const path = location.replace(/^\/+/, '');
  if (!path) return { kind: 'overview' };

  if (path.startsWith(STORY_PREFIX)) {
    const [rawId = '', rawMode] = path.slice(STORY_PREFIX.length).split('/');
    return {
      kind: 'snapshot',
      id: decode(rawId),
      mode: isDiffMode(rawMode) ? rawMode : DEFAULT_MODE,
    };
  }

  const bareId = decode(path);
  return hasSnapshot(bareId)
    ? { kind: 'snapshot', id: bareId, mode: DEFAULT_MODE }
    : { kind: 'overview' };
}

export function buildRoute(route: Route): string {
  if (route.kind === 'overview') return '/';
  return `/${STORY_PREFIX}${encodeURIComponent(route.id)}/${route.mode}`;
}
