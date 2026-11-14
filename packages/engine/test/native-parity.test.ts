import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type DiffOptions,
  encodePng,
  engineKind,
  NATIVE_DIR,
  nativeBindingFileName,
  typescriptEngine,
} from '../src/index.js';

/**
 * The native build must be a drop-in for the TypeScript engine: same changed
 * pixels, same regions, same dimensions, for every kind of change. These tests
 * run only when a native binding has been built (pnpm build:native).
 */

interface Native {
  compareImagesRust(a: Buffer, b: Buffer, options?: DiffOptions): Comparison;
  compareRawRgba(
    a: Buffer,
    b: Buffer,
    width: number,
    height: number,
    options?: DiffOptions,
  ): Comparison;
}

interface Comparison {
  diffCount: number;
  diffPercentage: number;
  isSameDimensions: boolean;
  width: number;
  height: number;
  hasDiff: boolean;
  boundingBoxes: unknown[];
  diffImage?: Uint8Array | null;
}

function loadNative(): Native | undefined {
  try {
    const file = path.resolve(
      import.meta.dirname,
      '..',
      NATIVE_DIR,
      nativeBindingFileName(),
    );
    return createRequire(import.meta.url)(file) as Native;
  } catch {
    return undefined;
  }
}

const native = loadNative();
const WIDTH = 64;
const HEIGHT = 48;

function canvas(
  paint: (x: number, y: number) => [number, number, number, number],
  width = WIDTH,
  height = HEIGHT,
): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
}

const checker = (x: number, y: number): [number, number, number, number] => {
  const v = ((x >> 3) + (y >> 3)) % 2 ? 230 : 250;
  return [v, v, v + (x % 4), 255];
};

const scenarios: Array<{
  name: string;
  baseline: Buffer;
  candidate: Buffer;
  options?: DiffOptions;
  width?: number;
  height?: number;
}> = [
  {
    name: 'identical images',
    baseline: canvas(checker),
    candidate: canvas(checker),
  },
  {
    name: 'a solid block changed colour',
    baseline: canvas(checker),
    candidate: canvas((x, y) =>
      x > 10 && x < 40 && y > 8 && y < 30 ? [200, 40, 60, 255] : checker(x, y),
    ),
  },
  {
    name: 'a change below the threshold',
    baseline: canvas(checker),
    candidate: canvas((x, y) => {
      const [r, g, b, a] = checker(x, y);
      return [Math.min(255, r + 3), g, b, a];
    }),
  },
  {
    name: 'the whole image shifted by one pixel',
    baseline: canvas(checker),
    candidate: canvas((x, y) => checker(Math.min(WIDTH - 1, x + 1), y)),
  },
  {
    name: 'semi-transparent pixels',
    baseline: canvas((x, y) => [200, 100, 50, x % 2 ? 255 : 128]),
    candidate: canvas((x, y) => [200, 100, 50, x % 2 ? 255 : 90]),
  },
  {
    name: 'a stricter threshold',
    baseline: canvas(checker),
    candidate: canvas((x, y) => {
      const [r, g, b, a] = checker(x, y);
      return [Math.min(255, r + 12), g, b, a];
    }),
    options: { threshold: 0.01 },
  },
  {
    name: 'anti-aliasing counted as change',
    baseline: canvas((x, y) =>
      x < 32 ? [0, 0, 0, 255] : [255, 255, 255, 255],
    ),
    candidate: canvas((x, y) =>
      x < 31
        ? [0, 0, 0, 255]
        : x === 31
          ? [128, 128, 128, 255]
          : [255, 255, 255, 255],
    ),
    options: { includeAntiAliasing: true },
  },
  {
    name: 'different dimensions',
    baseline: canvas(checker, 64, 48),
    candidate: canvas(checker, 80, 40),
    width: 64,
    height: 48,
  },
];

function summarize(result: Comparison) {
  return {
    diffCount: result.diffCount,
    diffPercentage: Number(result.diffPercentage.toFixed(6)),
    isSameDimensions: result.isSameDimensions,
    width: result.width,
    height: result.height,
    hasDiff: result.hasDiff,
    boundingBoxes: result.boundingBoxes,
  };
}

describe.skipIf(!native)('native engine matches the TypeScript engine', () => {
  for (const scenario of scenarios) {
    it(`agrees on ${scenario.name}`, async () => {
      const [bw, bh] = [scenario.width ?? WIDTH, scenario.height ?? HEIGHT];
      const sameSize = scenario.baseline.length === scenario.candidate.length;

      const toPng = (data: Buffer, w: number, h: number) =>
        encodePng(data, w, h);
      const candidateSize = sameSize ? [bw, bh] : [80, 40];
      const baselinePng = toPng(scenario.baseline, bw, bh);
      const candidatePng = toPng(
        scenario.candidate,
        candidateSize[0] ?? bw,
        candidateSize[1] ?? bh,
      );

      const options = { generateDiffImage: false, ...scenario.options };
      const expected = await typescriptEngine.compareImages(
        baselinePng,
        candidatePng,
        options,
      );
      const actual = native?.compareImagesRust(
        baselinePng,
        candidatePng,
        options,
      );

      expect(summarize(actual as Comparison)).toEqual(summarize(expected));
    });
  }

  it('agrees on raw RGBA buffers', () => {
    const baseline = canvas(checker);
    const candidate = canvas((x, y) =>
      x > 5 && x < 20 ? [10, 200, 90, 255] : checker(x, y),
    );
    const expected = typescriptEngine.compareRawRgba(
      baseline,
      candidate,
      WIDTH,
      HEIGHT,
      { generateDiffImage: false },
    );
    const actual = native?.compareRawRgba(baseline, candidate, WIDTH, HEIGHT, {
      generateDiffImage: false,
    });
    expect(summarize(actual as Comparison)).toEqual(summarize(expected));
  });

  it('rejects a buffer that does not match the stated size', () => {
    expect(() =>
      native?.compareRawRgba(Buffer.alloc(16), Buffer.alloc(16), 10, 10),
    ).toThrow(/needs/);
  });

  it('is the implementation the engine selects once built', () => {
    expect(engineKind()).toBe('native');
  });
});

describe('engine selection', () => {
  it('reports which implementation is running', () => {
    expect(['native', 'typescript']).toContain(engineKind());
  });
});
