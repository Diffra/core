import {
  compareImages,
  type DiffOptions,
  type DiffResult,
} from '@diffra/engine';
import type { DiffEngineAdapter } from '../../types/index.js';

/** Name reported for the built-in diff engine. */
export const NATIVE_DIFF_ENGINE_NAME = 'diffra-native';

export class NativeDiffEngine implements DiffEngineAdapter {
  readonly name = NATIVE_DIFF_ENGINE_NAME;

  compare(
    baseline: Buffer,
    candidate: Buffer,
    options?: DiffOptions,
  ): Promise<DiffResult> {
    return compareImages(baseline, candidate, options);
  }
}

export function createNativeDiffEngine(): DiffEngineAdapter {
  return new NativeDiffEngine();
}
