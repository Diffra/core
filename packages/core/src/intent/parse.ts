import type { NewIntent } from './index.js';

/** The line that starts an intent in a pull request description or commit message. */
export const INTENT_KEY = 'Visual-Intent';

const LIST_KEYS = {
  targets: `${INTENT_KEY}-Targets`,
  sources: `${INTENT_KEY}-Sources`,
  selectors: `${INTENT_KEY}-Selectors`,
} as const;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Reads intents from free text. An intent starts at a `Visual-Intent:` line,
 * which is its description, and takes the `-Targets`, `-Sources` and
 * `-Selectors` lines that follow, each a comma-separated list:
 *
 *     Visual-Intent: Roomier buttons
 *     Visual-Intent-Sources: src/button.css
 *     Visual-Intent-Targets: button
 *
 * Keys are not case sensitive. Text around the lines is ignored, so the lines
 * can sit anywhere in a description. An intent that names no scope is returned
 * as written and is refused when it is declared.
 */
export function parseIntentBlock(text: string): NewIntent[] {
  const intents: NewIntent[] = [];
  let current: NewIntent | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*]\s+/, '');
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === INTENT_KEY.toLowerCase()) {
      current = { description: value, author: 'human' };
      intents.push(current);
      continue;
    }
    if (!current) continue;
    for (const [field, name] of Object.entries(LIST_KEYS)) {
      if (key === name.toLowerCase()) {
        const scope = field as keyof typeof LIST_KEYS;
        current[scope] = [...(current[scope] ?? []), ...splitList(value)];
      }
    }
  }
  return intents;
}
