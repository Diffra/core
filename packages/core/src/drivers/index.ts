export * from './image.js';
export * from './storybook.js';
export * from './url.js';

import type {
  DiffraConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';
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

  // 1. Explicit multi-driver array
  if (config.drivers && Array.isArray(config.drivers)) {
    for (const d of config.drivers) {
      if (typeof d === 'string') {
        if (d === 'storybook') drivers.push(createStorybookDriver());
        else if (d === 'url') drivers.push(createUrlDriver());
        else if (d === 'image') drivers.push(createImageDriver());
      } else if (d && typeof d === 'object' && 'name' in d) {
        drivers.push(d);
      }
    }
    if (drivers.length > 0) {
      return drivers;
    }
  }

  // 2. Explicit single driver
  if (config.driver) {
    if (typeof config.driver === 'string') {
      if (config.driver === 'storybook') return [createStorybookDriver()];
      if (config.driver === 'url') return [createUrlDriver()];
      if (config.driver === 'image') return [createImageDriver()];
    } else if (typeof config.driver === 'object' && 'name' in config.driver) {
      return [config.driver];
    }
  }

  // 3. Explicit in-memory targets
  if (config.targets) {
    drivers.push(new TargetListDriver(config.targets));
    return drivers;
  }

  // 4. Inferred drivers based on options
  if (config.urls && config.urls.length > 0) {
    return [createUrlDriver()];
  }

  if (config.imagesDir) {
    return [createImageDriver()];
  }

  // 5. Default fallback to Storybook driver
  return [createStorybookDriver()];
}
