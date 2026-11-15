import { describe, expect, it } from 'vitest';
import { parseIntentBlock } from '../../src/intent/parse.js';

describe('parseIntentBlock', () => {
  it('reads an intent and its scopes from a description', () => {
    const body = `## Summary
Makes the buttons roomier.

Visual-Intent: Roomier buttons
Visual-Intent-Sources: src/button.css, src/tokens.css
Visual-Intent-Targets: button
Visual-Intent-Selectors: .btn

Thanks for reviewing!`;
    expect(parseIntentBlock(body)).toEqual([
      {
        description: 'Roomier buttons',
        author: 'human',
        sources: ['src/button.css', 'src/tokens.css'],
        targets: ['button'],
        selectors: ['.btn'],
      },
    ]);
  });

  it('reads several intents, each with its own scopes', () => {
    const intents = parseIntentBlock(
      [
        'Visual-Intent: First',
        'Visual-Intent-Targets: a',
        'Visual-Intent: Second',
        'Visual-Intent-Targets: b',
        'Visual-Intent-Targets: c',
      ].join('\n'),
    );
    expect(intents.map((i) => [i.description, i.targets])).toEqual([
      ['First', ['a']],
      ['Second', ['b', 'c']],
    ]);
  });

  it('ignores case, list bullets and carriage returns', () => {
    const intents = parseIntentBlock(
      '- visual-intent: Tidy\r\n- VISUAL-INTENT-SOURCES: a.css\r\n',
    );
    expect(intents).toEqual([
      { description: 'Tidy', author: 'human', sources: ['a.css'] },
    ]);
  });

  it('ignores scope lines that come before any intent, and unrelated text', () => {
    expect(
      parseIntentBlock('Visual-Intent-Targets: a\nNote: nothing to see'),
    ).toEqual([]);
    expect(parseIntentBlock('')).toEqual([]);
  });
});
