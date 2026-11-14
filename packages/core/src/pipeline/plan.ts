import type { CaptureTask } from '../capture/screenshot-runner.js';
import { DEFAULT_VIEWPORTS } from '../config/schema.js';
import type { PluginRunner } from '../plugins/runner.js';
import type {
  DiffraConfig,
  DriverContext,
  Project,
  Viewport,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';
import { normalizeViewport } from '../utils/viewport.js';

export const DEFAULT_BROWSER = 'chromium';

const DEFAULT_PROJECTS: Project[] = [
  { name: DEFAULT_BROWSER, browser: DEFAULT_BROWSER },
];
const SHARD_PATTERN = /^(\d+)\/(\d+)$/;

export interface DiscoveredTargets {
  targets: VisualTarget[];
  /** The driver that produced a target, which may capture it itself */
  driverFor(target: VisualTarget): VisualDriver | undefined;
}

/** Asks every driver for its targets, then lets plugins adjust the list. */
export async function discoverTargets(
  drivers: VisualDriver[],
  context: DriverContext,
  plugins: PluginRunner,
): Promise<DiscoveredTargets> {
  const byTarget = new Map<VisualTarget, VisualDriver>();
  const byId = new Map<string, VisualDriver>();
  const discovered: VisualTarget[] = [];

  for (const driver of drivers) {
    if (!driver.discover) continue;
    for (const target of await driver.discover(context)) {
      byTarget.set(target, driver);
      byId.set(target.id, driver);
      discovered.push(target);
    }
  }

  return {
    targets: await plugins.hookDiscoverTargets(discovered),
    // Plugins may return copies of targets, so fall back to matching by id.
    driverFor: (target) => byTarget.get(target) ?? byId.get(target.id),
  };
}

export function resolveProjects(config: DiffraConfig): Project[] {
  const configured = config.runner?.projects;
  return configured && configured.length > 0 ? configured : DEFAULT_PROJECTS;
}

/** Keeps every Nth task so CI shards split the work without overlap. */
export function applyShard<T>(tasks: T[], shard: string | undefined): T[] {
  const match = shard?.match(SHARD_PATTERN);
  if (!match) return tasks;
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (index < 1 || total < 1 || index > total) return tasks;
  return tasks.filter((_, i) => i % total === index - 1);
}

/** Expands targets into one capture task per project and viewport. */
export function buildTasks(
  discovered: DiscoveredTargets,
  config: DiffraConfig,
  shard?: string,
): CaptureTask[] {
  const defaultViewports = (
    config.snapshot?.viewports || DEFAULT_VIEWPORTS
  ).map(normalizeViewport);
  const projects = resolveProjects(config);
  const tasks: CaptureTask[] = [];

  for (const target of discovered.targets) {
    const driver = discovered.driverFor(target);
    const viewports: Viewport[] = target.snapshot?.viewports
      ? target.snapshot.viewports.map(normalizeViewport)
      : defaultViewports;

    for (const project of projects) {
      // A project that fixes its own viewport replaces the target's viewports.
      const effective = project.use?.viewport
        ? [normalizeViewport(project.use.viewport)]
        : viewports;
      for (const viewport of effective) {
        tasks.push({ target, viewport, project, driver });
      }
    }
  }

  return applyShard(tasks, shard || config.runner?.shard);
}
