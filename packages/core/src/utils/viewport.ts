import type { Viewport, ViewportInput } from '../types/index.js';

export function toKebabCase(str: string): string {
  return str
    .trim()
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[/\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[^\w]+|[^\w]+$/g, '');
}

export function toStoryId(title: string, storyName: string): string {
  return `${toKebabCase(title)}--${toKebabCase(storyName)}`;
}

export function normalizeViewport(vp: ViewportInput): Viewport {
  if (typeof vp === 'number') {
    return {
      name: `${vp}px`,
      width: vp,
      height: 800,
    };
  }
  const name = 'name' in vp && vp.name ? vp.name : `${vp.width}x${vp.height}`;
  return {
    name,
    width: vp.width,
    height: vp.height || 800,
  };
}
