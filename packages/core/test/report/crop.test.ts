import { decodePng, encodePng } from '@diffra/engine';
import { describe, expect, it } from 'vitest';
import { cropPng } from '../../src/report/crop.js';

const SIZE = 20;

/** An image whose red channel holds the pixel's column and green its row. */
function gradient(): Buffer {
  const data = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      data[i] = x;
      data[i + 1] = y;
      data[i + 3] = 255;
    }
  }
  return encodePng(data, SIZE, SIZE);
}

describe('cropPng', () => {
  it('cuts the inclusive box out of the image', () => {
    const out = decodePng(
      cropPng(gradient(), { minX: 4, minY: 6, maxX: 7, maxY: 9 }, 0),
    );
    expect([out.width, out.height]).toEqual([4, 4]);
    expect([out.data[0], out.data[1]]).toEqual([4, 6]);
    const last = (out.height - 1) * out.width * 4 + (out.width - 1) * 4;
    expect([out.data[last], out.data[last + 1]]).toEqual([7, 9]);
  });

  it('adds padding and clamps it to the image', () => {
    const out = decodePng(
      cropPng(gradient(), { minX: 1, minY: 1, maxX: 3, maxY: 3 }, 5),
    );
    expect([out.width, out.height]).toEqual([9, 9]);
    expect([out.data[0], out.data[1]]).toEqual([0, 0]);
  });

  it('refuses a region outside the image', () => {
    expect(() =>
      cropPng(gradient(), { minX: 50, minY: 50, maxX: 60, maxY: 60 }, 0),
    ).toThrow(/outside/);
  });
});
