import crypto from 'node:crypto';

/** SHA-256 of image bytes, as lowercase hex. */
export function sha256Hex(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
