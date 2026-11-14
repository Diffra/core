import {
  compareImages,
  type DiffOptions,
  type DiffResult,
  engineKind,
} from '@diffra/engine';
import type { DiffEngineAdapter } from '../../types/index.js';

export class NativeDiffEngine implements DiffEngineAdapter {
  /** Names the implementation actually running, native or TypeScript. */
  get name(): string {
    return `diffra-${engineKind()}`;
  }

  async compare(
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
