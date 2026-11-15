import { type BoundingBox, decodePng, encodePng } from '@diffra/engine';

/** Pixels of surrounding context kept around a region when it is cropped. */
export const DEFAULT_CROP_PADDING = 16;

const RGBA_CHANNELS = 4;

/**
 * Cuts a region out of a PNG. Box coordinates are inclusive pixel positions,
 * as the engine reports them, and the padded region is clamped to the image.
 * Returns the PNG of the region, which lets a reader look at one changed area
 * instead of the whole snapshot.
 */
export function cropPng(
  png: Buffer,
  box: BoundingBox,
  padding: number = DEFAULT_CROP_PADDING,
): Buffer {
  const image = decodePng(png);
  const minX = Math.max(0, Math.floor(box.minX) - padding);
  const minY = Math.max(0, Math.floor(box.minY) - padding);
  const maxX = Math.min(image.width - 1, Math.ceil(box.maxX) + padding);
  const maxY = Math.min(image.height - 1, Math.ceil(box.maxY) + padding);
  if (minX > maxX || minY > maxY) {
    throw new Error(
      `Region ${JSON.stringify(box)} is outside the ${image.width}x${image.height} image.`,
    );
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const out = Buffer.alloc(width * height * RGBA_CHANNELS);
  for (let row = 0; row < height; row++) {
    const from = ((minY + row) * image.width + minX) * RGBA_CHANNELS;
    image.data.copy(
      out,
      row * width * RGBA_CHANNELS,
      from,
      from + width * RGBA_CHANNELS,
    );
  }
  return encodePng(out, width, height);
}
