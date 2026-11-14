import { describe, expect, it } from 'vitest';
import {
  compareImages,
  compareRawRGBA,
  DEFAULT_THRESHOLD,
  decodePng,
  encodePng,
} from '../index.js';

describe('images of different sizes', () => {
  /**
   * A baseline twice as tall as the candidate, with a pattern that sends the
   * anti-aliasing check across the bottom edge of the shared region. Reading
   * past the shorter image used to abort the process.
   */
  it('compares a taller baseline without reading past the candidate', async () => {
    const width = 24;
    const sharedHeight = 48;
    const baselineHeight = sharedHeight * 2;
    const shade = (x: number, y: number) =>
      100 + 20 * (x % 3) + (y >= sharedHeight ? 2 : 0);

    const baseline = Buffer.alloc(width * baselineHeight * 4, 255);
    const candidate = Buffer.alloc(width * sharedHeight * 4, 255);
    for (let y = 0; y < baselineHeight; y++) {
      for (let x = 0; x < width; x++) {
        baseline.fill(
          shade(x, y),
          (y * width + x) * 4,
          (y * width + x) * 4 + 3,
        );
        if (y < sharedHeight) {
          // The last shared row is brighter, so it differs from the baseline.
          const value = y === sharedHeight - 1 ? shade(x, y) + 60 : shade(x, y);
          candidate.fill(value, (y * width + x) * 4, (y * width + x) * 4 + 3);
        }
      }
    }

    const result = await compareImages(
      encodePng(baseline, width, baselineHeight),
      encodePng(candidate, width, sharedHeight),
      { diffThreshold: 0.063 },
    );

    expect(result.isSameDimensions).toBe(false);
    expect(result.height).toBe(baselineHeight);
    expect(result.hasDiff).toBe(true);
  });

  it('compares a wider candidate than baseline', async () => {
    const solid = (width: number, height: number, value: number) =>
      encodePng(Buffer.alloc(width * height * 4, value), width, height);
    const result = await compareImages(
      solid(16, 16, 80),
      solid(32, 16, 80),
      {},
    );
    expect(result.isSameDimensions).toBe(false);
    expect(result.width).toBe(32);
    expect(result.diffCount).toBe(16 * 16);
  });
});

describe('image comparison', () => {
  it('honors 0.0 threshold as exact match without falling back to 0.063', () => {
    const width = 1;
    const height = 1;
    const base = Buffer.from([100, 100, 100, 255]);
    // Candidate with 1-unit RGB difference
    const cand = Buffer.from([101, 100, 100, 255]);

    // At threshold 0.0, 1 unit difference MUST trigger a diff
    const resZero = compareRawRGBA(base, cand, width, height, {
      diffThreshold: 0.0,
    });
    expect(resZero.diffCount).toBe(1);
    expect(resZero.hasDiff).toBe(true);

    // At default threshold (0.063), 1 unit difference must NOT trigger a diff
    const resDefault = compareRawRGBA(base, cand, width, height, {});
    expect(resDefault.diffCount).toBe(0);
    expect(resDefault.hasDiff).toBe(false);
  });

  it('honors explicit diffThreshold: 0.063 and threshold: 0.063 identically to default', () => {
    const width = 2;
    const height = 2;
    const base = Buffer.alloc(width * height * 4, 100);
    const cand = Buffer.alloc(width * height * 4, 102);

    const resDefault = compareRawRGBA(base, cand, width, height, {});
    const resExplicit = compareRawRGBA(base, cand, width, height, {
      diffThreshold: 0.063,
    });
    const resAlias = compareRawRGBA(base, cand, width, height, {
      threshold: 0.063,
    });

    expect(resDefault.diffCount).toBe(resExplicit.diffCount);
    expect(resDefault.diffCount).toBe(resAlias.diffCount);
    expect(resDefault.hasDiff).toBe(resExplicit.hasDiff);
  });

  it('switches from unchanged to changed at the 0.063 boundary', () => {
    // 35215 * 0.063^2 = 139.768
    // For pure red change: YIQ colorDeltaSq for [dr, 0, 0, 0] is:
    // y = 0.29889531 * dr, i = 0.59597799 * dr, q = 0.21147017 * dr
    // deltaSq = dr^2 * (0.5053*0.2989^2 + 0.299*0.596^2 + 0.1957*0.211^2) = dr^2 * 0.1601
    // At dr = 29: deltaSq ≈ 29^2 * 0.1601 ≈ 134.6 < 139.768 -> NO DIFF
    // At dr = 30: deltaSq ≈ 30^2 * 0.1601 ≈ 144.1 > 139.768 -> DIFF
    const width = 1;
    const height = 1;
    const base = Buffer.from([100, 100, 100, 255]);

    const candBelow = Buffer.from([129, 100, 100, 255]);
    const resBelow = compareRawRGBA(base, candBelow, width, height, {});
    expect(resBelow.diffCount).toBe(0);

    const candAbove = Buffer.from([130, 100, 100, 255]);
    const resAbove = compareRawRGBA(base, candAbove, width, height, {});
    expect(resAbove.diffCount).toBe(1);

    // Permissive threshold (1.0) ignores delta of 30
    const resPermissive = compareRawRGBA(base, candAbove, width, height, {
      diffThreshold: 1.0,
    });
    expect(resPermissive.diffCount).toBe(0);
  });

  it('handles identical and different PNG buffers losslessly via compareImages', async () => {
    const raw = Buffer.alloc(10 * 10 * 4, 150);
    const png = encodePng(raw, 10, 10);

    const identical = await compareImages(png, png);
    expect(identical.diffCount).toBe(0);
    expect(identical.hasDiff).toBe(false);
    expect(identical.isSameDimensions).toBe(true);

    const rawDiff = Buffer.alloc(10 * 10 * 4, 150);
    rawDiff[0] = 0; // large diff at pixel (0,0)
    rawDiff[1] = 0;
    rawDiff[2] = 0;
    const pngDiff = encodePng(rawDiff, 10, 10);

    const diffRes = await compareImages(png, pngDiff, {
      diffThreshold: 0.063,
    });
    expect(diffRes.hasDiff).toBe(true);
    expect(diffRes.diffCount).toBe(1);
  });

  it('verifies 100% fast-path match for identical PNG buffers and raw RGBA buffers', async () => {
    const width = 64;
    const height = 64;
    const rawData = Buffer.alloc(width * height * 4);
    for (let i = 0; i < rawData.length; i += 4) {
      rawData[i] = 45; // R
      rawData[i + 1] = 90; // G
      rawData[i + 2] = 180; // B
      rawData[i + 3] = 255; // A
    }

    // Raw RGBA compare
    const rawResult = compareRawRGBA(rawData, rawData, width, height);
    expect(rawResult.diffCount).toBe(0);
    expect(rawResult.diffPercentage).toBe(0);
    expect(rawResult.hasDiff).toBe(false);
    expect(rawResult.isSameDimensions).toBe(true);
    expect(rawResult.boundingBoxes).toHaveLength(0);

    // PNG buffer compare (exercises identical buffer reference/byte equality fast-path)
    const pngBuffer = encodePng(rawData, width, height);
    const pngResult = await compareImages(pngBuffer, pngBuffer);
    expect(pngResult.diffCount).toBe(0);
    expect(pngResult.diffPercentage).toBe(0);
    expect(pngResult.hasDiff).toBe(false);
    expect(pngResult.isSameDimensions).toBe(true);
    expect(pngResult.boundingBoxes).toHaveLength(0);

    // Fully transparent identical image
    const transparentRaw = Buffer.alloc(32 * 32 * 4, 0);
    const transResult = compareRawRGBA(transparentRaw, transparentRaw, 32, 32);
    expect(transResult.diffCount).toBe(0);
    expect(transResult.hasDiff).toBe(false);
  });

  it('handles asymmetric dimension mismatches and verifies diff bounding boxes', async () => {
    // Baseline 40x20 vs Candidate 20x60
    const bw = 40;
    const bh = 20;
    const cw = 20;
    const ch = 60;

    const baseRgba = Buffer.alloc(bw * bh * 4, 200);
    const candRgba = Buffer.alloc(cw * ch * 4, 200);

    const basePng = encodePng(baseRgba, bw, bh);
    const candPng = encodePng(candRgba, cw, ch);

    const diff = await compareImages(basePng, candPng, {
      generateDiffImage: true,
    });

    expect(diff.isSameDimensions).toBe(false);
    expect(diff.width).toBe(Math.max(bw, cw)); // 40
    expect(diff.height).toBe(Math.max(bh, ch)); // 60
    expect(diff.hasDiff).toBe(true);
    expect(diff.diffCount).toBeGreaterThan(0);
    expect(diff.boundingBoxes.length).toBeGreaterThanOrEqual(1);

    // Diff image must be sized to max dimensions (40 x 60)
    expect(diff.diffImage).toBeDefined();
    if (diff.diffImage) {
      const decodedDiff = decodePng(diff.diffImage);
      expect(decodedDiff.width).toBe(40);
      expect(decodedDiff.height).toBe(60);
    }
  });

  it('discriminates subtle sub-pixel anti-aliasing from genuine color regressions', () => {
    // Create a 20x20 image with a vertical edge and an anti-aliased transition pixel
    const width = 20;
    const height = 20;
    const base = Buffer.alloc(width * height * 4, 255); // White background
    const cand = Buffer.alloc(width * height * 4, 255);

    // Draw dark bar on both
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 5; x++) {
        const idx = (y * width + x) * 4;
        base[idx] = 10;
        base[idx + 1] = 10;
        base[idx + 2] = 10;
        cand[idx] = 10;
        cand[idx + 1] = 10;
        cand[idx + 2] = 10;
      }
    }

    // Add anti-aliasing gradient pixel at x = 5 (intermediate gray) in candidate only
    const aaIdx = (10 * width + 5) * 4;
    cand[aaIdx] = 140;
    cand[aaIdx + 1] = 140;
    cand[aaIdx + 2] = 140;

    // With anti-aliasing detection enabled (includeAntiAliasing: false, default)
    // The intermediate font-smoothing pixel adjacent to the dark line should be recognized as AA
    const resultIgnoreAA = compareRawRGBA(base, cand, width, height, {
      includeAntiAliasing: false,
    });

    // With anti-aliasing detection disabled (includeAntiAliasing: true)
    // Every difference is counted
    const resultIncludeAA = compareRawRGBA(base, cand, width, height, {
      includeAntiAliasing: true,
    });

    expect(resultIncludeAA.diffCount).toBeGreaterThan(0);
    expect(resultIgnoreAA.diffCount).toBeLessThanOrEqual(
      resultIncludeAA.diffCount,
    );

    // High-contrast non-anti-aliased change (pure neon green in an isolated pixel)
    const isolatedIdx = (5 * width + 15) * 4;
    cand[isolatedIdx] = 0;
    cand[isolatedIdx + 1] = 255;
    cand[isolatedIdx + 2] = 0;

    const resultHighContrast = compareRawRGBA(base, cand, width, height, {
      includeAntiAliasing: false,
    });
    // The isolated neon pixel MUST be flagged as a diff
    expect(resultHighContrast.hasDiff).toBe(true);
    expect(resultHighContrast.diffCount).toBeGreaterThanOrEqual(1);
  });

  it('applies thresholds across their whole range, including the aliases', () => {
    const width = 2;
    const height = 2;
    const base = Buffer.from([
      100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100,
      255,
    ]);

    // 1. Subtle 1-unit delta in candidate
    const candSubtle = Buffer.from([
      101, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100,
      255,
    ]);

    // At diffThreshold: 0.0 -> zero tolerance, must flag diff
    const resZero = compareRawRGBA(base, candSubtle, width, height, {
      diffThreshold: 0.0,
    });
    expect(resZero.diffCount).toBe(1);
    expect(resZero.hasDiff).toBe(true);

    // At default diffThreshold (0.063) -> subtle 1-unit delta must NOT flag diff
    const resDefault = compareRawRGBA(base, candSubtle, width, height, {
      diffThreshold: DEFAULT_THRESHOLD,
    });
    expect(resDefault.diffCount).toBe(0);
    expect(resDefault.hasDiff).toBe(false);

    // Verify alias `threshold` matches `diffThreshold`
    const resAlias = compareRawRGBA(base, candSubtle, width, height, {
      threshold: 0.0,
    });
    expect(resAlias.diffCount).toBe(1);

    // 2. Substantial delta (RGB delta 50)
    const candLarge = Buffer.from([
      150, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100,
      255,
    ]);

    // At default 0.063 -> flags diff
    const resFlagged = compareRawRGBA(base, candLarge, width, height, {
      diffThreshold: 0.063,
    });
    expect(resFlagged.diffCount).toBe(1);
    expect(resFlagged.hasDiff).toBe(true);

    // At diffThreshold 1.0 (maximum tolerance) -> suppresses diff
    const resPermissive = compareRawRGBA(base, candLarge, width, height, {
      diffThreshold: 1.0,
    });
    expect(resPermissive.diffCount).toBe(0);
    expect(resPermissive.hasDiff).toBe(false);
  });

  it('supports custom diffColor and diffMask options in diff buffer generation', () => {
    const width = 10;
    const height = 10;
    const base = Buffer.alloc(width * height * 4, 255);
    const cand = Buffer.alloc(width * height * 4, 255);

    // Change pixel (0,0) to black
    cand[0] = 0;
    cand[1] = 0;
    cand[2] = 0;

    // Custom diff color: neon green [0, 255, 0, 255] with diffMask
    const result = compareRawRGBA(base, cand, width, height, {
      diffColor: [0, 255, 0, 255],
      diffMask: true,
      generateDiffImage: true,
    });

    expect(result.hasDiff).toBe(true);
    expect(result.diffImage).toBeDefined();

    if (result.diffImage) {
      const decoded = decodePng(result.diffImage);
      // Changed pixel (0,0) should match custom neon green
      expect(decoded.data[0]).toBe(0); // R
      expect(decoded.data[1]).toBe(255); // G
      expect(decoded.data[2]).toBe(0); // B
      expect(decoded.data[3]).toBe(255); // A

      // Unchanged pixel (1,0) under diffMask: true must be black [0, 0, 0, 255]
      const unchangedIdx = 4;
      expect(decoded.data[unchangedIdx]).toBe(0);
      expect(decoded.data[unchangedIdx + 1]).toBe(0);
      expect(decoded.data[unchangedIdx + 2]).toBe(0);
      expect(decoded.data[unchangedIdx + 3]).toBe(255);
    }
  });

  it('rejects with a message naming the input that cannot be decoded', async () => {
    const validPng = encodePng(Buffer.alloc(10 * 10 * 4, 128), 10, 10);
    const corruptBuffer = Buffer.from('NOT_A_VALID_PNG_FILE_HEADER_DATA');

    await expect(compareImages(validPng, corruptBuffer)).rejects.toThrow(
      /candidate/,
    );
    await expect(compareImages(corruptBuffer, validPng)).rejects.toThrow(
      /baseline/,
    );
  });

  it('rejects raw buffers whose size does not match the dimensions', () => {
    const tooShort = Buffer.alloc(3);
    const valid = Buffer.alloc(4);
    expect(() => compareRawRGBA(tooShort, valid, 1, 1)).toThrow(/baseline/);
    expect(() => compareRawRGBA(valid, tooShort, 1, 1)).toThrow(/candidate/);
  });
});
