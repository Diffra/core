import type React from 'react';
import { AppFrame, Icon, type IconName, Logo } from '../../ui';

const SEARCH_CARD_OVERFLOW = 'visible' as const;

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const RANGE_START = 12;
const RANGE_END = 19;

const Month: React.FC<{
  year: number;
  month: number;
  title: string;
  ranged: boolean;
}> = ({ year, month, title, ranged }) => {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  return (
    <div style={{ width: 276 }}>
      <div
        style={{
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          rowGap: 4,
          textAlign: 'center',
        }}
      >
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink-500)',
              padding: '6px 0',
            }}
          >
            {weekday}
          </span>
        ))}
        {cells.map((day, index) => {
          const inRange =
            ranged && day !== null && day >= RANGE_START && day <= RANGE_END;
          const edge = ranged && (day === RANGE_START || day === RANGE_END);
          return (
            <span
              // Blank cells before the first of the month have no other identity.
              key={day ?? `blank-${index}`}
              style={{
                padding: '9px 0',
                fontSize: 15,
                fontWeight: edge ? 800 : 600,
                color: edge ? '#ffffff' : 'var(--ink-900)',
                background: edge
                  ? 'var(--brand-500)'
                  : inRange
                    ? 'var(--brand-50)'
                    : 'transparent',
                borderRadius: edge ? 12 : 0,
              }}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const Segment: React.FC<{
  label: string;
  value: string;
  icon: IconName;
  active?: boolean;
}> = ({ label, value, icon, active = false }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 22px',
      borderRadius: 18,
      background: active ? 'var(--brand-50)' : 'transparent',
    }}
  >
    <Icon name={icon} size={22} color="var(--brand-500)" />
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.06em',
          color: 'var(--ink-500)',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 3, fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  </div>
);

export const HotelSearchPage: React.FC = () => (
  <AppFrame
    style={{
      background:
        'linear-gradient(180deg, #bae6fd 0%, #e0f2fe 46%, #fef3c7 100%)',
      padding: '26px 64px',
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Logo name="Wayfarer" accent="#0284c7" />
      <span style={{ fontSize: 16, fontWeight: 700 }}>My trips</span>
    </header>
    <h1
      style={{
        margin: '56px 0 34px',
        fontSize: 62,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: '-0.035em',
        maxWidth: 760,
      }}
    >
      Find your next escape
    </h1>

    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 28,
        background: '#ffffff',
        boxShadow: '0 24px 60px rgba(2, 132, 199, 0.25)',
        overflow: SEARCH_CARD_OVERFLOW,
      }}
    >
      <Segment label="WHERE" value="Lisbon, Portugal" icon="pin" />
      <Segment label="CHECK IN" value="Sat, 12 Dec" icon="calendar" active />
      <Segment label="CHECK OUT" value="Sat, 19 Dec" icon="calendar" />
      <Segment label="GUESTS" value="2 adults" icon="users" />
      <span
        style={{
          padding: '20px 32px',
          borderRadius: 20,
          fontSize: 18,
          fontWeight: 800,
          color: '#ffffff',
          background: '#0284c7',
        }}
      >
        Search
      </span>

      <div
        role="dialog"
        aria-label="Choose dates"
        style={{
          position: 'absolute',
          top: 'calc(100% + 16px)',
          left: 270,
          display: 'flex',
          gap: 40,
          padding: 34,
          borderRadius: 28,
          background: '#ffffff',
          boxShadow: '0 30px 70px rgba(15, 23, 42, 0.28)',
        }}
      >
        <Month year={2026} month={11} title="December 2026" ranged />
        <Month year={2027} month={0} title="January 2027" ranged={false} />
      </div>
    </div>
  </AppFrame>
);
