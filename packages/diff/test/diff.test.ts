import { describe, expect, it } from 'vitest';
import {
  clusterBoundingBoxes,
  compareImages,
  compareRawRGBA,
  decodePng,
  encodePng,
} from '../src/index.js';

describe('@diffra/diff', () => {
  it('detects 0 diffs for identical raw RGBA buffers', () => {
    const width = 20;
    const height = 20;
    const buf1 = Buffer.alloc(width * height * 4, 255);
    const buf2 = Buffer.alloc(width * height * 4, 255);

    const result = compareRawRGBA(buf1, buf2, width, height);
    expect(result.diffCount).toBe(0);
    expect(result.diffPercentage).toBe(0);
    expect(result.hasDiff).toBe(false);
    expect(result.isSameDimensions).toBe(true);
    expect(result.boundingBoxes).toHaveLength(0);
  });

  it('detects differences and generates spatial bounding boxes for changed regions', () => {
    const width = 100;
    const height = 100;
    const buf1 = Buffer.alloc(width * height * 4, 255);
    const buf2 = Buffer.alloc(width * height * 4, 255);

    // Introduce a 10x10 changed square at (20, 20) in candidate
    for (let y = 20; y < 30; y++) {
      for (let x = 20; x < 30; x++) {
        const idx = (y * width + x) * 4;
        buf2[idx] = 0;
        buf2[idx + 1] = 0;
        buf2[idx + 2] = 0;
      }
    }

    const result = compareRawRGBA(buf1, buf2, width, height);
    expect(result.hasDiff).toBe(true);
    expect(result.diffCount).toBe(100);
    expect(result.diffPercentage).toBe(1.0);
    expect(result.boundingBoxes.length).toBeGreaterThanOrEqual(1);

    const box = result.boundingBoxes[0];
    expect(box.minX).toBeLessThanOrEqual(20);
    expect(box.maxX).toBeGreaterThanOrEqual(29);
    expect(box.minY).toBeLessThanOrEqual(20);
    expect(box.maxY).toBeGreaterThanOrEqual(29);
  });

  it('clusters spatial bounding boxes into separate bounding regions', () => {
    const changed = [
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 80, y: 80 },
    ];
    const boxes = clusterBoundingBoxes(changed, 100, 100, 32);
    expect(boxes.length).toBe(2);
  });

  it('encodes and decodes PNG buffers losslessly', () => {
    const width = 16;
    const height = 16;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 120; // R
      rgba[i + 1] = 200; // G
      rgba[i + 2] = 50; // B
      rgba[i + 3] = 255; // A
    }

    const pngBuffer = encodePng(rgba, width, height);
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(0);

    const decoded = decodePng(pngBuffer);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.data.equals(rgba)).toBe(true);
  });

  it('compares real encoded PNG images and generates diff images', async () => {
    const width = 40;
    const height = 40;
    const baseRgba = Buffer.alloc(width * height * 4, 255);
    const candRgba = Buffer.alloc(width * height * 4, 255);

    // Add a black rectangle in candidate
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        const idx = (y * width + x) * 4;
        candRgba[idx] = 0;
        candRgba[idx + 1] = 0;
        candRgba[idx + 2] = 0;
      }
    }

    const basePng = encodePng(baseRgba, width, height);
    const candPng = encodePng(candRgba, width, height);

    const diff = await compareImages(basePng, candPng, {
      diffThreshold: 0.063,
      generateDiffImage: true,
    });

    expect(diff.hasDiff).toBe(true);
    expect(diff.diffCount).toBe(100);
    expect(diff.diffPercentage).toBeCloseTo((100 / 1600) * 100, 1);
    expect(diff.diffImage).toBeDefined();
    expect(diff.boundingBoxes.length).toBeGreaterThanOrEqual(1);

    // Decode generated diff image and verify it's a valid PNG
    if (diff.diffImage) {
      const decodedDiff = decodePng(diff.diffImage);
      expect(decodedDiff.width).toBe(width);
      expect(decodedDiff.height).toBe(height);
    }
  });

  it('handles dimension mismatch between baseline and candidate images', async () => {
    const baseRgba = Buffer.alloc(20 * 20 * 4, 255);
    const candRgba = Buffer.alloc(30 * 40 * 4, 255);

    const basePng = encodePng(baseRgba, 20, 20);
    const candPng = encodePng(candRgba, 30, 40);

    const diff = await compareImages(basePng, candPng);
    expect(diff.isSameDimensions).toBe(false);
    expect(diff.width).toBe(30);
    expect(diff.height).toBe(40);
    expect(diff.hasDiff).toBe(true);
  });
});
