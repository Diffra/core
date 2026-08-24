export interface DiffOptions {
  /**
   * Perceptual color threshold from 0.0 (strict) to 1.0 (permissive).
   * Standard Storybook/Diffra default is 0.063.
   */
  threshold?: number;

  /**
   * Alias for threshold.
   */
  diffThreshold?: number;

  /**
   * If true, anti-aliased pixels are considered differences (default: false).
   */
  includeAntiAliasing?: boolean;

  /**
   * Opacity of original image in diff output (0.0 to 1.0, default 0.15).
   */
  alpha?: number;

  /**
   * Diff pixel highlight color [R, G, B] or [R, G, B, A] (default [255, 0, 85, 255]).
   */
  diffColor?: [number, number, number] | [number, number, number, number];

  /**
   * Diff color for anti-aliased pixels if detected.
   */
  diffColorAlt?: [number, number, number];

  /**
   * If true, renders a solid black background behind diff pixels instead of dimmed baseline.
   */
  diffMask?: boolean;

  /**
   * Whether to encode and return a PNG diff buffer (default: true).
   */
  generateDiffImage?: boolean;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DiffResult {
  diffCount: number;
  diffPercentage: number;
  isSameDimensions: boolean;
  width: number;
  height: number;
  boundingBoxes: BoundingBox[];
  diffImage?: Buffer;
  hasDiff: boolean;
}
