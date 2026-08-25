export * from './figma.js';
export * from './image.js';
export * from './storybook.js';
export * from './url.js';

import type {
  DiffraConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';
import { createFigmaDriver } from './figma.js';
import { createImageDriver } from './image.js';
import { createStorybookDriver } from './storybook.js';
import { createUrlDriver } from './url.js';

/**
 * In-memory custom target driver when `targets` array/function is supplied in configuration.
 */
export class TargetListDriver implements VisualDriver {
  name = 'targets';
  private targetProvider:
    | VisualTarget[]
    | (() => Promise<VisualTarget[]> | VisualTarget[]);

  constructor(
    provider: VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[]),
  ) {
    this.targetProvider = provider;
  }

  async discover(): Promise<VisualTarget[]> {
    if (typeof this.targetProvider === 'function') {
      return await this.targetProvider();
    }
    return this.targetProvider || [];
  }
}

/**
 * Resolves configured drivers based on user configuration.
 */
export function resolveDrivers(
  config: DiffraConfig,
  _cwd = process.cwd(),
): VisualDriver[] {
  const drivers: VisualDriver[] = [];

  // 1. Explicit drivers (single driver or array)
  if (config.drivers) {
    const rawDrivers = Array.isArray(config.drivers)
      ? config.drivers
      : [config.drivers];

    for (const d of rawDrivers) {
      if (typeof d === 'string') {
        if (d === 'storybook') drivers.push(createStorybookDriver());
        else if (d === 'url') drivers.push(createUrlDriver());
        else if (d === 'image') drivers.push(createImageDriver());
        else if (d === 'figma') drivers.push(createFigmaDriver());
      } else if (d && typeof d === 'object') {
        if ('driver' in d) {
          if (d.driver === 'storybook') drivers.push(createStorybookDriver(d));
          else if (d.driver === 'url') drivers.push(createUrlDriver(d));
          else if (d.driver === 'image') drivers.push(createImageDriver(d));
          else if (d.driver === 'figma') drivers.push(createFigmaDriver(d));
        } else if ('name' in d) {
          drivers.push(d as VisualDriver);
        }
      }
    }
    if (drivers.length > 0) {
      return drivers;
    }
  }

  // 2. Explicit in-memory targets
  if (config.targets) {
    drivers.push(new TargetListDriver(config.targets));
    return drivers;
  }

  // 3. Default fallback to Storybook driver
  return [createStorybookDriver()];
}
