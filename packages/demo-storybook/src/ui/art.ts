/**
 * Self-contained artwork, so the screens need no network access and render
 * the same on every machine.
 */
const svgUri = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export type ProductKind =
  | 'chair'
  | 'lamp'
  | 'bottle'
  | 'bag'
  | 'watch'
  | 'shoe';

const SHAPES: Record<ProductKind, string> = {
  chair:
    '<rect x="120" y="70" width="80" height="90" rx="14"/><rect x="104" y="150" width="112" height="26" rx="10"/><rect x="116" y="176" width="10" height="46" rx="4"/><rect x="194" y="176" width="10" height="46" rx="4"/>',
  lamp: '<path d="M120 70h80l24 80H96z"/><rect x="156" y="150" width="8" height="58" rx="3"/><rect x="124" y="206" width="72" height="12" rx="6"/>',
  bottle:
    '<rect x="146" y="58" width="28" height="30" rx="6"/><rect x="124" y="84" width="72" height="140" rx="26"/>',
  bag: '<path d="M126 104a34 34 0 0 1 68 0" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><rect x="100" y="104" width="120" height="116" rx="18"/>',
  watch:
    '<rect x="140" y="52" width="40" height="40" rx="8"/><rect x="140" y="188" width="40" height="40" rx="8"/><circle cx="160" cy="140" r="52"/><circle cx="160" cy="140" r="38" fill="rgba(0,0,0,0.18)"/>',
  shoe: '<path d="M90 176c0-34 18-52 40-52l30 14c18 8 44 8 70 18v28c0 12-8 20-20 20H110c-12 0-20-10-20-28Z"/>',
};

/** A product photo stand-in: a gradient backdrop with a simple object. */
export function productPhoto(
  from: string,
  to: string,
  kind: ProductKind,
): string {
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="280" viewBox="0 0 320 280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="280" fill="url(#g)"/><ellipse cx="160" cy="236" rx="86" ry="10" fill="rgba(0,0,0,0.14)"/><g fill="rgba(255,255,255,0.9)">${SHAPES[kind]}</g></svg>`,
  );
}

/** A browser window showing a product dashboard, used as a hero image. */
export function dashboardPreview(): string {
  const bars = [60, 92, 74, 120, 98, 148, 126]
    .map(
      (height, index) =>
        `<rect x="${196 + index * 44}" y="${330 - height}" width="26" height="${height}" rx="7" fill="url(#bar)"/>`,
    )
    .join('');
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="400" viewBox="0 0 520 400"><defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs><rect x="4" y="4" width="512" height="392" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/><rect x="4" y="4" width="512" height="44" rx="20" fill="#f1f5f9"/><circle cx="30" cy="26" r="6" fill="#f87171"/><circle cx="50" cy="26" r="6" fill="#fbbf24"/><circle cx="70" cy="26" r="6" fill="#34d399"/><rect x="22" y="70" width="136" height="306" rx="12" fill="#f8fafc"/><rect x="36" y="88" width="80" height="12" rx="6" fill="#c7d2fe"/><rect x="36" y="120" width="100" height="10" rx="5" fill="#e2e8f0"/><rect x="36" y="144" width="88" height="10" rx="5" fill="#e2e8f0"/><rect x="36" y="168" width="104" height="10" rx="5" fill="#e2e8f0"/><rect x="180" y="70" width="96" height="64" rx="12" fill="#eef2ff"/><rect x="288" y="70" width="96" height="64" rx="12" fill="#ecfdf5"/><rect x="396" y="70" width="104" height="64" rx="12" fill="#fff7ed"/><rect x="194" y="86" width="40" height="10" rx="5" fill="#a5b4fc"/><rect x="302" y="86" width="40" height="10" rx="5" fill="#86efac"/><rect x="410" y="86" width="40" height="10" rx="5" fill="#fdba74"/><rect x="194" y="106" width="58" height="16" rx="6" fill="#4f46e5"/><rect x="302" y="106" width="58" height="16" rx="6" fill="#16a34a"/><rect x="410" y="106" width="58" height="16" rx="6" fill="#ea580c"/><rect x="180" y="152" width="320" height="224" rx="14" fill="#ffffff" stroke="#e2e8f0"/>${bars}<path d="M196 300 C 260 250, 300 290, 360 220 S 460 200, 490 180" fill="none" stroke="#f472b6" stroke-width="4" stroke-linecap="round"/></svg>`,
  );
}
