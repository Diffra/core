import zlib from 'node:zlib';

export interface DecodedPng {
  width: number;
  height: number;
  data: Buffer; // RGBA 8-bit per channel
}

// CRC32 table for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer, start = 0, length = buf.length): number {
  let c = 0xffffffff;
  for (let i = start; i < start + length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodes a PNG buffer into raw 8-bit RGBA pixel buffer.
 */
export function decodePng(buffer: Buffer): DecodedPng {
  const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(PNG_HEADER)) {
    throw new Error('Invalid PNG signature');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6; // 6 = RGBA, 2 = RGB, 0 = Grayscale
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];

      if (bitDepth !== 8) {
        throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
      }
      if (colorType !== 6 && colorType !== 2 && colorType !== 0) {
        throw new Error(`Unsupported PNG color type: ${colorType}`);
      }
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4; // Skip CRC
  }

  if (width === 0 || height === 0) {
    throw new Error('Missing or invalid IHDR chunk in PNG');
  }

  const compressedData = Buffer.concat(idatChunks);
  const uncompressed = zlib.inflateSync(compressedData);

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const bpp = channels; // 1 byte per channel at 8 bitDepth
  const scanlineLength = 1 + width * bpp;
  const rawRgba = Buffer.alloc(width * height * 4);

  let prevScanline: Buffer | null = null;

  for (let y = 0; y < height; y++) {
    const scanlineStart = y * scanlineLength;
    const filterType = uncompressed[scanlineStart];
    const scanline = Buffer.alloc(width * bpp);

    for (let i = 0; i < width * bpp; i++) {
      const rawVal = uncompressed[scanlineStart + 1 + i];
      const left = i >= bpp ? scanline[i - bpp] : 0;
      const up = prevScanline ? prevScanline[i] : 0;
      const upLeft = prevScanline && i >= bpp ? prevScanline[i - bpp] : 0;

      let val = 0;
      switch (filterType) {
        case 0: // None
          val = rawVal;
          break;
        case 1: // Sub
          val = (rawVal + left) & 0xff;
          break;
        case 2: // Up
          val = (rawVal + up) & 0xff;
          break;
        case 3: // Average
          val = (rawVal + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4: // Paeth
          val = (rawVal + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          val = rawVal;
      }
      scanline[i] = val;
    }

    // Convert scanline into target 4-channel RGBA
    for (let x = 0; x < width; x++) {
      const srcIdx = x * bpp;
      const destIdx = (y * width + x) * 4;

      if (colorType === 6) {
        // RGBA
        rawRgba[destIdx] = scanline[srcIdx];
        rawRgba[destIdx + 1] = scanline[srcIdx + 1];
        rawRgba[destIdx + 2] = scanline[srcIdx + 2];
        rawRgba[destIdx + 3] = scanline[srcIdx + 3];
      } else if (colorType === 2) {
        // RGB
        rawRgba[destIdx] = scanline[srcIdx];
        rawRgba[destIdx + 1] = scanline[srcIdx + 1];
        rawRgba[destIdx + 2] = scanline[srcIdx + 2];
        rawRgba[destIdx + 3] = 255;
      } else {
        // Grayscale
        const gray = scanline[srcIdx];
        rawRgba[destIdx] = gray;
        rawRgba[destIdx + 1] = gray;
        rawRgba[destIdx + 2] = gray;
        rawRgba[destIdx + 3] = 255;
      }
    }

    prevScanline = scanline;
  }

  return {
    width,
    height,
    data: rawRgba,
  };
}

/**
 * Encodes a raw 8-bit RGBA buffer into a valid PNG buffer.
 */
export function encodePng(
  rgbaData: Buffer | Uint8Array,
  width: number,
  height: number,
): Buffer {
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0; // Filter: None
    const rgbaOffset = y * width * 4;
    for (let x = 0; x < width * 4; x++) {
      rawData[rawOffset + 1 + x] = rgbaData[rgbaOffset + x];
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 6 });

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression: deflate
  ihdrData[11] = 0; // Filter: standard
  ihdrData[12] = 0; // Interlace: none

  const ihdrChunk = createPngChunk('IHDR', ihdrData);
  const idatChunk = createPngChunk('IDAT', compressedData);
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function createPngChunk(typeStr: string, data: Buffer): Buffer {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(typeStr, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const typeAndData = chunk.subarray(4, 8 + length);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + length);

  return chunk;
}
