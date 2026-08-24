import { compareImages, type DiffOptions, type DiffResult } from '@diffra/diff';
import type { DiffEngineAdapter } from '../../types/index.js';

export class NativeDiffEngine implements DiffEngineAdapter {
  name = 'native-rust-simd';

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
