import type React from 'react';
import { useState } from 'react';
import { baseText, palette, radius } from '../../theme';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavBarProps {
  brand: string;
  items: NavItem[];
  activeId: string;
  /** Shown as the account initials. Signed-out visitors get a sign-in action. */
  userName?: string;
  notificationCount?: number;
}

/** Viewport width below which the links collapse into the menu button. */
const COLLAPSE_BELOW = '640px';
const MAX_BADGE_COUNT = 99;

const NAV_CSS = `
.dfx-nav-links { display: flex; gap: 4px; }
.dfx-nav-toggle { display: none; }
.dfx-nav-drawer { display: none; }
@media (max-width: ${COLLAPSE_BELOW}) {
  .dfx-nav-links { display: none; }
  .dfx-nav-toggle { display: inline-flex; }
  .dfx-nav-drawer[data-open='true'] { display: flex; }
}
.dfx-nav a, .dfx-nav button { font: inherit; }
`;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const linkStyle = (active: boolean): React.CSSProperties => ({
  ...baseText,
  fontSize: '15px',
  fontWeight: active ? 600 : 500,
  color: active ? palette.text : palette.textMuted,
  background: active ? palette.raised : 'transparent',
  padding: '8px 12px',
  borderRadius: radius.small,
  textDecoration: 'none',
});

const NotificationBell: React.FC<{ count: number }> = ({ count }) => (
  <span style={{ position: 'relative', display: 'inline-flex' }}>
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={palette.textMuted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Notifications"
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
    {count > 0 && (
      <span
        style={{
          position: 'absolute',
          top: '-6px',
          right: '-10px',
          minWidth: '18px',
          padding: '0 5px',
          boxSizing: 'border-box',
          height: '18px',
          lineHeight: '18px',
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 700,
          color: '#ffffff',
          background: palette.danger,
          borderRadius: radius.pill,
        }}
      >
        {count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count}
      </span>
    )}
  </span>
);

export const NavBar: React.FC<NavBarProps> = ({
  brand,
  items,
  activeId,
  userName,
  notificationCount = 0,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <header
      className="dfx-nav"
      style={{
        ...baseText,
        background: palette.surface,
        borderBottom: `1px solid ${palette.border}`,
        width: '100%',
      }}
    >
      <style>{NAV_CSS}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '12px 20px',
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 700 }}>{brand}</span>
        <nav className="dfx-nav-links" aria-label="Primary">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={item.id === activeId ? 'page' : undefined}
              style={linkStyle(item.id === activeId)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          {userName ? (
            <>
              <NotificationBell count={notificationCount} />
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: palette.accentStrong,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {initialsOf(userName)}
              </span>
            </>
          ) : (
            <a
              href="#sign-in"
              style={{
                ...linkStyle(false),
                border: `1px solid ${palette.border}`,
                color: palette.text,
              }}
            >
              Sign in
            </a>
          )}
          <button
            type="button"
            className="dfx-nav-toggle"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              color: palette.text,
              background: palette.raised,
              border: `1px solid ${palette.border}`,
              borderRadius: radius.small,
              cursor: 'pointer',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path
                d={open ? 'M4 4l10 10M14 4L4 14' : 'M3 5h12M3 9h12M3 13h12'}
              />
            </svg>
          </button>
        </div>
      </div>
      <nav
        className="dfx-nav-drawer"
        data-open={open}
        aria-label="Mobile"
        style={{
          flexDirection: 'column',
          gap: '4px',
          padding: '8px 20px 16px',
          borderTop: `1px solid ${palette.border}`,
        }}
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={item.id === activeId ? 'page' : undefined}
            style={linkStyle(item.id === activeId)}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
};
