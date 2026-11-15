import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Cause,
  CauseElement,
  Explanation,
  PropertyChange,
} from './explain.js';
import { SIDE_FAMILIES } from './explain.js';

/** Lines of unchanged text kept around a change in a patch. */
export const PATCH_CONTEXT_LINES = 3;

export interface FixSuggestion {
  element: CauseElement;
  /** The stylesheet and rule that set the changed styles. */
  origin?: string;
  selector?: string;
  /** The stylesheet as a path in the project, when it was found there. */
  file?: string;
  /** Whether that file differs from the baseline commit. */
  inBranch?: boolean;
  /** The styles to put back, as the browser computed them. */
  restore: PropertyChange[];
  /** A unified diff that puts them back, when it could be written without guessing. */
  patch?: string;
  /** In words, what to do and why there is or is not a patch. */
  note: string;
}

export interface FixSuggestions {
  suggestions: FixSuggestion[];
  note: string;
}

const BLOCK = /([^{}]+)\{([^{}]*)\}/g;

/** Blanks out comments but keeps every position and line break where it was. */
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
}

function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function normalizeValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** The declaration of a property inside a rule's body, with where its value is. */
function findDeclaration(
  body: string,
  property: string,
): { start: number; end: number; value: string } | undefined {
  const match = new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;]+)`).exec(body);
  if (!match || match.index === undefined) return undefined;
  const raw = match[1] ?? '';
  const important = /\s*!important\s*$/i.exec(raw);
  const value = important ? raw.slice(0, important.index) : raw;
  const start = match.index + match[0].length - raw.length;
  return { start, end: start + value.length, value: normalizeValue(value) };
}

/**
 * Puts values back in the declarations of one rule. Returns what could not be
 * found written as the browser computed it: a value written as `2rem` or
 * `red` is not matched by `32px` or `rgb(255, 0, 0)`, and is not guessed at.
 */
function restoreInRule(
  body: string,
  restore: PropertyChange[],
): { body: string; missing: string[] } {
  let result = body;
  const edits: Array<{ start: number; end: number; value: string }> = [];
  const missing: string[] = [];
  const handled = new Set<string>();

  for (const [shorthand, sides] of SIDE_FAMILIES) {
    const members = sides
      .map((side) => restore.find((c) => c.property === side))
      .filter((c): c is PropertyChange => c !== undefined);
    const [first] = members;
    if (
      members.length !== sides.length ||
      !first ||
      !members.every(
        (m) => m.before === first.before && m.after === first.after,
      )
    ) {
      continue;
    }
    const declaration = findDeclaration(result, shorthand);
    if (declaration && declaration.value === first.after) {
      edits.push({ ...declaration, value: first.before });
      for (const side of sides) handled.add(side);
    }
  }

  for (const change of restore) {
    if (handled.has(change.property)) continue;
    const declaration = findDeclaration(result, change.property);
    if (declaration && declaration.value === normalizeValue(change.after)) {
      edits.push({ ...declaration, value: change.before });
    } else {
      missing.push(change.property);
    }
  }

  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`;
  }
  return { body: result, missing };
}

/**
 * Puts the earlier styles back in the first rule of a stylesheet whose
 * selector is the one given. Returns nothing when the rule is not found, or
 * when any of the styles cannot be found in it, since a patch that restores
 * only some of them would mislead.
 */
export function restoreInStylesheet(
  text: string,
  selector: string,
  restore: PropertyChange[],
): { text: string } | { missing: string[] } {
  const wanted = normalizeSelector(selector);
  const searchable = blankComments(text);
  for (const match of searchable.matchAll(BLOCK)) {
    if (normalizeSelector(match[1] ?? '') !== wanted) continue;
    const bodyStart = (match.index ?? 0) + (match[1] ?? '').length + 1;
    const body = text.slice(bodyStart, bodyStart + (match[2] ?? '').length);
    const restored = restoreInRule(body, restore);
    if (restored.missing.length > 0) return { missing: restored.missing };
    return {
      text: `${text.slice(0, bodyStart)}${restored.body}${text.slice(bodyStart + body.length)}`,
    };
  }
  return { missing: restore.map((c) => c.property) };
}

/** A unified diff between two texts that have the same number of lines. */
export function unifiedDiff(
  file: string,
  before: string,
  after: string,
): string {
  const endsWithNewline = before.endsWith('\n');
  const a = before.split('\n');
  const b = after.split('\n');
  // Text that ends with a line break has no line after it.
  if (endsWithNewline) {
    a.pop();
    b.pop();
  }
  const noNewline = endsWithNewline ? '' : '\\ No newline at end of file\n';
  const changed = a
    .map((line, index) => (line === b[index] ? -1 : index))
    .filter((index) => index >= 0);
  if (changed.length === 0 || a.length !== b.length) return '';

  const hunks: Array<{ from: number; to: number }> = [];
  for (const index of changed) {
    const last = hunks[hunks.length - 1];
    if (last && index - last.to <= PATCH_CONTEXT_LINES * 2) last.to = index;
    else hunks.push({ from: index, to: index });
  }

  let out = `--- a/${file}\n+++ b/${file}\n`;
  for (const hunk of hunks) {
    const start = Math.max(0, hunk.from - PATCH_CONTEXT_LINES);
    const end = Math.min(a.length - 1, hunk.to + PATCH_CONTEXT_LINES);
    const count = end - start + 1;
    out += `@@ -${start + 1},${count} +${start + 1},${count} @@\n`;
    for (let i = start; i <= end; i++) {
      const marker = i === a.length - 1 ? noNewline : '';
      if (a[i] === b[i]) out += ` ${a[i]}\n${marker}`;
      else out += `-${a[i]}\n${marker}+${b[i]}\n${marker}`;
    }
  }
  return out;
}

/** The stylesheet an origin names, as a path in the project, if it is there. */
async function findProjectFile(
  origin: string,
  cwd: string,
): Promise<string | undefined> {
  const relative = origin.split('?')[0]?.replace(/^\/+/, '');
  if (!relative) return undefined;
  const root = path.resolve(cwd);
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(root + path.sep)) return undefined;
  try {
    if ((await fs.stat(resolved)).isFile()) {
      return path.relative(root, resolved).split(path.sep).join('/');
    }
  } catch {}
  return undefined;
}

async function suggestFor(cause: Cause, cwd: string): Promise<FixSuggestion> {
  const base = {
    element: cause.element,
    restore: cause.changes,
    ...(cause.source
      ? {
          origin: cause.source.origin,
          selector: cause.source.selector,
          ...(cause.source.inBranch !== undefined
            ? { inBranch: cause.source.inBranch }
            : {}),
        }
      : {}),
  };
  const values = cause.changes
    .map((c) => `${c.property} ${c.after} back to ${c.before}`)
    .join(', ');

  if (!cause.source) {
    return {
      ...base,
      note: `Put ${values} on this element. No stylesheet rule sets them, so they come from an inline style or a script.`,
    };
  }
  const file = await findProjectFile(cause.source.origin, cwd);
  if (!file) {
    return {
      ...base,
      note: `Put ${values} in the rule ${cause.source.selector} of ${cause.source.origin}. That file is not in the project, so it may be built from another source.`,
    };
  }

  const text = await fs.readFile(path.resolve(cwd, file), 'utf-8');
  const restored = restoreInStylesheet(
    text,
    cause.source.selector,
    cause.changes,
  );
  if ('missing' in restored) {
    return {
      ...base,
      file,
      note: `Put ${values} in the rule ${cause.source.selector} of ${file}. No patch is offered because ${restored.missing.join(', ')} ${restored.missing.length === 1 ? 'is' : 'are'} not written there as the browser computed ${restored.missing.length === 1 ? 'it' : 'them'}, such as a value in rem or a color name.`,
    };
  }
  return {
    ...base,
    file,
    patch: unifiedDiff(file, text, restored.text),
    note: `Applying the patch puts ${values} back in ${file}. It restores the earlier styles; if the new ones were wanted, this is the change to undo, not to keep.`,
  };
}

/**
 * Says how to undo the changes that were proven to cause a difference. A fix
 * is only suggested once the cause is proven, since undoing a guess would
 * waste an attempt. A patch is offered only when the earlier values can be
 * written back into the stylesheet exactly; otherwise the suggestion says
 * what to restore and where.
 */
export async function suggestFixes(input: {
  explanation: Explanation;
  cwd: string;
}): Promise<FixSuggestions> {
  const { explanation, cwd } = input;
  if (explanation.proof?.status !== 'proven') {
    return {
      suggestions: [],
      note: 'No fix is suggested yet: the cause is not proven. Run diffra_prove (or diffra prove) first, so that the fix undoes a cause that is known to produce the difference.',
    };
  }
  const causes = explanation.causes.filter((c) => c.changes.length > 0);
  const suggestions = await Promise.all(causes.map((c) => suggestFor(c, cwd)));
  return {
    suggestions,
    note:
      suggestions.length === 0
        ? 'The proven change is not a style change that can be restored.'
        : 'Each suggestion undoes a change that was shown to produce the difference. Apply a patch only if the change was not intended.',
  };
}
