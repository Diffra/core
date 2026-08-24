export * from './native.js';

import type { DiffEngineAdapter, DiffraConfig } from '../../types/index.js';
import { createNativeDiffEngine } from './native.js';

export function resolveDiffEngine(config: DiffraConfig): DiffEngineAdapter {
  if (config.diffEngine && typeof config.diffEngine.compare === 'function') {
    return config.diffEngine;
  }
  return createNativeDiffEngine();
}
