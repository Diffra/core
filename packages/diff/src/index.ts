import fs from 'node:fs';
import path from 'node:path';
import { clusterBoundingBoxes } from './clustering.js';
import { decodePng, encodePng } from './png.js';
import type { DiffOptions, DiffResult } from './types.js';

export * from './clustering.js';
export * from './png.js';
export * from './types.js';

const DEFAULT_THRESHOLD = 0.063;

interface NativeBinding {
  compareImagesRust?: (
    baseline: Buffer,
    candidate: Buffer,
    options?: DiffOptions,
  ) => DiffResult;
  compareRawRgba?: (
    baseline: Uint8Array | Buffer,
    candidate: Uint8Array | Buffer,
    width: number,
    height: number,
    options?: DiffOptions,
  ) => DiffResult;
}

let nativeBinding: NativeBinding | null = null;

function loadNativeBinding(): NativeBinding | null {
  if (nativeBinding) return nativeBinding;

  const possiblePaths = [
    path.join(process.cwd(), 'diffra-diff.node'),
    path.join(
      process.cwd(),
      `diffra-diff.${process.platform}-${process.arch}.node`,
    ),
    path.join(process.cwd(), 'dist', 'diffra-diff.node'),
    path.join(process.cwd(), 'packages', 'diff', 'diffra-diff.node'),
    path.join(
      process.cwd(),
      'packages',
      'diff',
      `diffra-diff.${process.platform}-${process.arch}.node`,
    ),
  ];

  for (const bindingPath of possiblePaths) {
    if (fs.existsSync(bindingPath)) {
      try {
        const req = (
          globalThis as unknown as { require?: (p: string) => NativeBinding }
        ).require;
        nativeBinding = req ? req(bindingPath) : null;
        if (nativeBinding) return nativeBinding;
      } catch {
        // Continue searching
      }
    }
  }

  return null;
}

/**
 * High-performance visual regression comparison using native Rust SIMD engine if available,
 * or pure TypeScript YIQ perceptual color difference engine with anti-aliasing detection.
 */
export async function compareImages(
  baselineBuffer: Buffer,
  candidateBuffer: Buffer,
  options: DiffOptions = {},
): Promise<DiffResult> {
  const binding = loadNativeBinding();
  if (binding && typeof binding.compareImagesRust === 'function') {
    try {
      return binding.compareImagesRust(
        baselineBuffer,
        candidateBuffer,
        options,
      );
    } catch {
      // Fallback on native execution error
    }
  }

  return fallbackCompareImages(baselineBuffer, candidateBuffer, options);
}

/**
 * Compare raw RGBA buffers directly via SIMD/Native engine or pure TypeScript engine.
 */
export function compareRawRGBA(
  baselineData: Uint8Array | Buffer,
  candidateData: Uint8Array | Buffer,
  width: number,
  height: number,
  options: DiffOptions = {},
): DiffResult {
  const binding = loadNativeBinding();
  if (binding && typeof binding.compareRawRgba === 'function') {
    try {
      return binding.compareRawRgba(
        baselineData,
        candidateData,
        width,
        height,
        options,
      );
    } catch {
      // Fallback on native error
    }
  }

  return fallbackCompareRaw(
    baselineData,
    candidateData,
    width,
    height,
    options,
  );
}

/**
 * Calculate perceptual color difference between two RGBA pixels using YIQ color space.
 */
function colorDeltaSq(
  r1: number,
  g1: number,
  b1: number,
  a1: number,
  r2: number,
  g2: number,
  b2: number,
  a2: number,
): number {
  if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
    return 0;
  }

  let pr1 = r1;
  let pg1 = g1;
  let pb1 = b1;
  if (a1 < 255) {
    const alpha = a1 / 255;
    pr1 = pr1 * alpha + 255 * (1 - alpha);
    pg1 = pg1 * alpha + 255 * (1 - alpha);
    pb1 = pb1 * alpha + 255 * (1 - alpha);
  }

  let pr2 = r2;
  let pg2 = g2;
  let pb2 = b2;
  if (a2 < 255) {
    const alpha = a2 / 255;
    pr2 = pr2 * alpha + 255 * (1 - alpha);
    pg2 = pg2 * alpha + 255 * (1 - alpha);
    pb2 = pb2 * alpha + 255 * (1 - alpha);
  }

  const y1 = pr1 * 0.29889531 + pg1 * 0.58662247 + pb1 * 0.11448223;
  const i1 = pr1 * 0.59597799 - pg1 * 0.2741761 - pb1 * 0.32180189;
  const q1 = pr1 * 0.21147017 - pg1 * 0.52261711 + pb1 * 0.31114694;

  const y2 = pr2 * 0.29889531 + pg2 * 0.58662247 + pb2 * 0.11448223;
  const i2 = pr2 * 0.59597799 - pg2 * 0.2741761 - pb2 * 0.32180189;
  const q2 = pr2 * 0.21147017 - pg2 * 0.52261711 + pb2 * 0.31114694;

  const dy = y1 - y2;
  const di = i1 - i2;
  const dq = q1 - q2;

  return 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
}

/**
 * Check if a pixel difference is anti-aliased font smoothing.
 */
function isAntialiased(
  img: Uint8Array | Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  other: Uint8Array | Buffer,
): boolean {
  const x0 = Math.max(x - 1, 0);
  const y0 = Math.max(y - 1, 0);
  const x1 = Math.min(x + 1, width - 1);
  const y1 = Math.min(y + 1, height - 1);

  let zeroes = 0;
  let positives = 0;
  let negatives = 0;
  let minDelta = Infinity;
  let maxDelta = -Infinity;
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  const targetIdx = (y * width + x) * 4;
  const tr = img[targetIdx];
  const tg = img[targetIdx + 1];
  const tb = img[targetIdx + 2];
  const ta = img[targetIdx + 3];

  for (let ny = y0; ny <= y1; ny++) {
    for (let nx = x0; nx <= x1; nx++) {
      if (nx === x && ny === y) continue;
      const nIdx = (ny * width + nx) * 4;
      const nr = img[nIdx];
      const ng = img[nIdx + 1];
      const nb = img[nIdx + 2];
      const na = img[nIdx + 3];

      const delta = colorDeltaSq(tr, tg, tb, ta, nr, ng, nb, na);

      if (delta < 1e-4) {
        zeroes++;
        if (zeroes > 2) return false;
      } else {
        const brightnessDiff = nr + ng + nb - (tr + tg + tb);
        if (brightnessDiff > 0) {
          positives++;
        } else {
          negatives++;
        }

        if (delta < minDelta) {
          minDelta = delta;
          minX = nx;
          minY = ny;
        }
        if (delta > maxDelta) {
          maxDelta = delta;
          maxX = nx;
          maxY = ny;
        }
      }
    }
  }

  if (zeroes === 0 || (positives !== 0 && negatives !== 0)) {
    return false;
  }

  const otherTargetIdx = (y * width + x) * 4;
  const otherMinIdx = (minY * width + minX) * 4;
  const otherMaxIdx = (maxY * width + maxX) * 4;

  const d1 = colorDeltaSq(
    other[otherTargetIdx],
    other[otherTargetIdx + 1],
    other[otherTargetIdx + 2],
    other[otherTargetIdx + 3],
    other[otherMinIdx],
    other[otherMinIdx + 1],
    other[otherMinIdx + 2],
    other[otherMinIdx + 3],
  );

  const d2 = colorDeltaSq(
    other[otherTargetIdx],
    other[otherTargetIdx + 1],
    other[otherTargetIdx + 2],
    other[otherTargetIdx + 3],
    other[otherMaxIdx],
    other[otherMaxIdx + 1],
    other[otherMaxIdx + 2],
    other[otherMaxIdx + 3],
  );

  return d1 < 1.0 || d2 < 1.0;
}

/**
 * Pure TypeScript comparison engine with perceptual YIQ color distance, anti-aliasing detection,
 * spatial bounding boxes clustering, and PNG diff buffer generation.
 */
function fallbackCompareRaw(
  baselineData: Uint8Array | Buffer,
  candidateData: Uint8Array | Buffer,
  width: number,
  height: number,
  options: DiffOptions = {},
): DiffResult {
  const threshold =
    options.diffThreshold ?? options.threshold ?? DEFAULT_THRESHOLD;
  const maxDelta = 35215 * threshold * threshold;
  const includeAA = options.includeAntiAliasing ?? false;
  const alphaVal = options.alpha ?? 0.15;
  const diffMaskOnly = options.diffMask ?? false;
  const generateDiffImage = options.generateDiffImage ?? true;

  const diffColor = options.diffColor || [255, 0, 85, 255];
  const dr = diffColor[0] ?? 255;
  const dg = diffColor[1] ?? 0;
  const db = diffColor[2] ?? 85;
  const da = diffColor[3] ?? 255;

  let diffCount = 0;
  const changedPixels: Array<{ x: number; y: number }> = [];
  const diffImg = generateDiffImage ? Buffer.alloc(width * height * 4) : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r1 = baselineData[idx];
      const g1 = baselineData[idx + 1];
      const b1 = baselineData[idx + 2];
      const a1 = baselineData[idx + 3];

      const r2 = candidateData[idx];
      const g2 = candidateData[idx + 1];
      const b2 = candidateData[idx + 2];
      const a2 = candidateData[idx + 3];

      if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
        if (diffImg) {
          if (diffMaskOnly) {
            diffImg[idx] = 0;
            diffImg[idx + 1] = 0;
            diffImg[idx + 2] = 0;
            diffImg[idx + 3] = 255;
          } else {
            diffImg[idx] = Math.round(r1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 1] = Math.round(g1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 2] = Math.round(b1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 3] = 255;
          }
        }
        continue;
      }

      const delta = colorDeltaSq(r1, g1, b1, a1, r2, g2, b2, a2);

      if (delta > maxDelta) {
        const isAA =
          !includeAA &&
          (isAntialiased(baselineData, x, y, width, height, candidateData) ||
            isAntialiased(candidateData, x, y, width, height, baselineData));

        if (!isAA) {
          diffCount++;
          changedPixels.push({ x, y });
          if (diffImg) {
            diffImg[idx] = dr;
            diffImg[idx + 1] = dg;
            diffImg[idx + 2] = db;
            diffImg[idx + 3] = da;
          }
        } else if (diffImg) {
          if (diffMaskOnly) {
            diffImg[idx] = 0;
            diffImg[idx + 1] = 0;
            diffImg[idx + 2] = 0;
            diffImg[idx + 3] = 255;
          } else {
            diffImg[idx] = Math.round(r1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 1] = Math.round(g1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 2] = Math.round(b1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 3] = 255;
          }
        }
      } else if (diffImg) {
        if (diffMaskOnly) {
          diffImg[idx] = 0;
          diffImg[idx + 1] = 0;
          diffImg[idx + 2] = 0;
          diffImg[idx + 3] = 255;
        } else {
          diffImg[idx] = Math.round(r1 * alphaVal + 255 * (1 - alphaVal));
          diffImg[idx + 1] = Math.round(g1 * alphaVal + 255 * (1 - alphaVal));
          diffImg[idx + 2] = Math.round(b1 * alphaVal + 255 * (1 - alphaVal));
          diffImg[idx + 3] = 255;
        }
      }
    }
  }

  const totalPixels = width * height;
  const diffPercentage = totalPixels > 0 ? (diffCount / totalPixels) * 100 : 0;
  const boundingBoxes = clusterBoundingBoxes(changedPixels, width, height);

  let diffImage: Buffer | undefined;
  if (diffImg && generateDiffImage) {
    try {
      diffImage = encodePng(diffImg, width, height);
    } catch {
      diffImage = undefined;
    }
  }

  return {
    diffCount,
    diffPercentage,
    isSameDimensions: true,
    width,
    height,
    boundingBoxes,
    diffImage,
    hasDiff: diffCount > 0,
  };
}

async function fallbackCompareImages(
  baselineBuffer: Buffer,
  candidateBuffer: Buffer,
  options: DiffOptions = {},
): Promise<DiffResult> {
  if (baselineBuffer.equals(candidateBuffer)) {
    try {
      const decoded = decodePng(baselineBuffer);
      return {
        diffCount: 0,
        diffPercentage: 0,
        isSameDimensions: true,
        width: decoded.width,
        height: decoded.height,
        boundingBoxes: [],
        diffImage: undefined,
        hasDiff: false,
      };
    } catch {
      return {
        diffCount: 0,
        diffPercentage: 0,
        isSameDimensions: true,
        width: 100,
        height: 100,
        boundingBoxes: [],
        diffImage: undefined,
        hasDiff: false,
      };
    }
  }

  let baseline: { width: number; height: number; data: Buffer };
  let candidate: { width: number; height: number; data: Buffer };

  try {
    baseline = decodePng(baselineBuffer);
    candidate = decodePng(candidateBuffer);
  } catch {
    return {
      diffCount: 1,
      diffPercentage: 100,
      isSameDimensions: false,
      width: 100,
      height: 100,
      boundingBoxes: [{ minX: 0, minY: 0, maxX: 99, maxY: 99 }],
      diffImage: undefined,
      hasDiff: true,
    };
  }

  const isSameDimensions =
    baseline.width === candidate.width && baseline.height === candidate.height;

  if (isSameDimensions) {
    const res = fallbackCompareRaw(
      baseline.data,
      candidate.data,
      baseline.width,
      baseline.height,
      options,
    );
    res.isSameDimensions = true;
    return res;
  }

  // Handle different dimensions
  const bw = baseline.width;
  const bh = baseline.height;
  const cw = candidate.width;
  const ch = candidate.height;
  const width = Math.max(bw, cw);
  const height = Math.max(bh, ch);

  const threshold =
    options.diffThreshold ?? options.threshold ?? DEFAULT_THRESHOLD;
  const maxDelta = 35215 * threshold * threshold;
  const includeAA = options.includeAntiAliasing ?? false;
  const alphaVal = options.alpha ?? 0.15;
  const diffMaskOnly = options.diffMask ?? false;
  const generateDiffImage = options.generateDiffImage ?? true;

  const diffColor = options.diffColor || [255, 0, 85, 255];
  const dr = diffColor[0] ?? 255;
  const dg = diffColor[1] ?? 0;
  const db = diffColor[2] ?? 85;
  const da = diffColor[3] ?? 255;

  let diffCount = 0;
  const changedPixels: Array<{ x: number; y: number }> = [];
  const diffImg = generateDiffImage ? Buffer.alloc(width * height * 4) : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const inBaseline = x < bw && y < bh;
      const inCandidate = x < cw && y < ch;

      if (inBaseline && inCandidate) {
        const bIdx = (y * bw + x) * 4;
        const cIdx = (y * cw + x) * 4;

        const r1 = baseline.data[bIdx];
        const g1 = baseline.data[bIdx + 1];
        const b1 = baseline.data[bIdx + 2];
        const a1 = baseline.data[bIdx + 3];

        const r2 = candidate.data[cIdx];
        const g2 = candidate.data[cIdx + 1];
        const b2 = candidate.data[cIdx + 2];
        const a2 = candidate.data[cIdx + 3];

        if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
          if (diffImg) {
            if (diffMaskOnly) {
              diffImg[idx] = 0;
              diffImg[idx + 1] = 0;
              diffImg[idx + 2] = 0;
              diffImg[idx + 3] = 255;
            } else {
              diffImg[idx] = Math.round(r1 * alphaVal + 255 * (1 - alphaVal));
              diffImg[idx + 1] = Math.round(
                g1 * alphaVal + 255 * (1 - alphaVal),
              );
              diffImg[idx + 2] = Math.round(
                b1 * alphaVal + 255 * (1 - alphaVal),
              );
              diffImg[idx + 3] = 255;
            }
          }
          continue;
        }

        const delta = colorDeltaSq(r1, g1, b1, a1, r2, g2, b2, a2);

        if (delta > maxDelta) {
          const isAA =
            !includeAA &&
            (isAntialiased(baseline.data, x, y, bw, bh, candidate.data) ||
              isAntialiased(candidate.data, x, y, cw, ch, baseline.data));

          if (!isAA) {
            diffCount++;
            changedPixels.push({ x, y });
            if (diffImg) {
              diffImg[idx] = dr;
              diffImg[idx + 1] = dg;
              diffImg[idx + 2] = db;
              diffImg[idx + 3] = da;
            }
          } else if (diffImg) {
            if (diffMaskOnly) {
              diffImg[idx] = 0;
              diffImg[idx + 1] = 0;
              diffImg[idx + 2] = 0;
              diffImg[idx + 3] = 255;
            } else {
              diffImg[idx] = Math.round(r1 * alphaVal + 255 * (1 - alphaVal));
              diffImg[idx + 1] = Math.round(
                g1 * alphaVal + 255 * (1 - alphaVal),
              );
              diffImg[idx + 2] = Math.round(
                b1 * alphaVal + 255 * (1 - alphaVal),
              );
              diffImg[idx + 3] = 255;
            }
          }
        } else if (diffImg) {
          if (diffMaskOnly) {
            diffImg[idx] = 0;
            diffImg[idx + 1] = 0;
            diffImg[idx + 2] = 0;
            diffImg[idx + 3] = 255;
          } else {
            diffImg[idx] = Math.round(r1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 1] = Math.round(g1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 2] = Math.round(b1 * alphaVal + 255 * (1 - alphaVal));
            diffImg[idx + 3] = 255;
          }
        }
      } else {
        // Pixel present in one image but missing in the other -> difference
        diffCount++;
        changedPixels.push({ x, y });
        if (diffImg) {
          diffImg[idx] = dr;
          diffImg[idx + 1] = dg;
          diffImg[idx + 2] = db;
          diffImg[idx + 3] = da;
        }
      }
    }
  }

  const totalPixels = width * height;
  const diffPercentage = totalPixels > 0 ? (diffCount / totalPixels) * 100 : 0;
  const boundingBoxes = clusterBoundingBoxes(changedPixels, width, height);

  let diffImage: Buffer | undefined;
  if (diffImg && generateDiffImage) {
    try {
      diffImage = encodePng(diffImg, width, height);
    } catch {
      diffImage = undefined;
    }
  }

  return {
    diffCount,
    diffPercentage,
    isSameDimensions: false,
    width,
    height,
    boundingBoxes,
    diffImage,
    hasDiff: diffCount > 0,
  };
}
