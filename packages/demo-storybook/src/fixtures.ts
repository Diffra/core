/**
 * Generates a small self-contained product photo placeholder, so stories need
 * no network access and render the same on every machine.
 */
export function placeholderPhoto(from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="160" cy="112" r="44" fill="rgba(255,255,255,0.22)"/><rect x="92" y="148" width="136" height="14" rx="7" fill="rgba(255,255,255,0.22)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A path the static server answers with 404, to exercise the image fallback. */
export const MISSING_PHOTO_PATH = 'media/products/does-not-exist.jpg';
