import type React from 'react';
import { AppFrame, Logo, Person } from '../../ui';

const BODY_LINE_HEIGHT = 1.75;

const PARAGRAPHS = [
  'Two years ago a release meant a two-week freeze, a spreadsheet of screens to click through, and a nervous Friday. Every team member had a different idea of what looked right, and the people who noticed a broken layout were usually customers.',
  'We started by writing down what we actually cared about: the pages that earn money, the flows that cannot break, and the screens that define how people feel about the product. That list turned out to be only forty screens.',
  'Each of those screens now gets captured on every pull request and compared with the last approved version. A reviewer sees exactly what moved, approves it in one click, and the baseline updates when the change merges.',
  'The result is boring in the best way. Releases are small, reviews are fast, and the Friday freeze is gone. We deploy whenever a change is ready, and the first person to see a visual regression is the author.',
];

const TOC = [
  'The old process',
  'What we measure',
  'Reviewing changes',
  'Results',
];

export const ArticlePage: React.FC = () => (
  <AppFrame style={{ background: '#ffffff' }}>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 72px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Logo name="Lumen" />
      <span
        style={{
          display: 'flex',
          gap: 30,
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--ink-500)',
        }}
      >
        <span>Product</span>
        <span style={{ color: 'var(--ink-900)' }}>Blog</span>
        <span>Changelog</span>
      </span>
    </header>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: 64,
        maxWidth: 1180,
        margin: '0 auto',
        padding: '44px 72px',
      }}
    >
      <article>
        <span
          style={{
            padding: '7px 14px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--brand-500)',
            background: 'var(--brand-50)',
          }}
        >
          Engineering
        </span>
        <h1
          style={{
            margin: '20px 0 22px',
            fontSize: 48,
            lineHeight: 1.12,
            fontWeight: 800,
            letterSpacing: '-0.03em',
          }}
        >
          How we cut our release cycle from two weeks to two hours
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 30,
          }}
        >
          <Person name="Priya Raman" color="#ec4899" size={46} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Priya Raman</div>
            <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>
              14 November 2026 · 8 min read
            </div>
          </div>
        </div>
        <div
          style={{
            height: 220,
            borderRadius: 24,
            marginBottom: 32,
            background:
              'linear-gradient(120deg, #6366f1, #ec4899 60%, #f59e0b)',
          }}
        />
        {PARAGRAPHS.map((paragraph) => (
          <p
            key={paragraph.slice(0, 24)}
            style={{
              marginBottom: 22,
              fontSize: 20,
              lineHeight: BODY_LINE_HEIGHT,
              color: 'var(--ink-700)',
            }}
          >
            {paragraph}
          </p>
        ))}
      </article>

      <aside style={{ alignSelf: 'start', paddingTop: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--ink-500)',
            marginBottom: 16,
          }}
        >
          ON THIS PAGE
        </div>
        <ul
          style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            borderLeft: '2px solid var(--line)',
          }}
        >
          {TOC.map((entry, index) => (
            <li
              key={entry}
              style={{
                padding: '8px 18px',
                marginLeft: -2,
                fontSize: 16,
                fontWeight: index === 0 ? 800 : 600,
                color: index === 0 ? 'var(--brand-500)' : 'var(--ink-500)',
                borderLeft: `2px solid ${index === 0 ? 'var(--brand-500)' : 'transparent'}`,
              }}
            >
              {entry}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  </AppFrame>
);
