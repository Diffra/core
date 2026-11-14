import type React from 'react';
import { useState } from 'react';
import { baseText, palette } from '../../theme';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  presence?: PresenceStatus;
}

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online: palette.success,
  away: palette.warning,
  offline: palette.textMuted,
};

/** Hues for initials avatars, picked from the name so each person is stable. */
const INITIALS_COLORS = ['#1f6feb', '#8957e5', '#bf3989', '#238636', '#9e6a03'];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function colorFor(name: string): string {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return INITIALS_COLORS[sum % INITIALS_COLORS.length] ?? palette.accentStrong;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 40,
  presence,
}) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed;
  const dot = Math.max(8, Math.round(size / 4));

  return (
    <span
      role="img"
      aria-label={name}
      style={{
        ...baseText,
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: colorFor(name),
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.38),
            fontWeight: 600,
          }}
        >
          {initialsOf(name)}
        </span>
      )}
      {presence && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: PRESENCE_COLOR[presence],
            border: `2px solid ${palette.surface}`,
            boxSizing: 'content-box',
          }}
        />
      )}
    </span>
  );
};

export interface AvatarGroupProps {
  people: Array<{ name: string; src?: string }>;
  /** How many avatars show before the rest collapse into a "+N" counter. */
  max?: number;
  size?: number;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  people,
  max = 4,
  size = 36,
}) => {
  const visible = people.slice(0, max);
  const hidden = people.length - visible.length;
  const overlap = Math.round(size / 4);

  return (
    <span
      style={{
        ...baseText,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px',
        background: palette.surface,
        borderRadius: '999px',
      }}
    >
      {visible.map((person, index) => (
        <span
          key={person.name}
          style={{
            marginLeft: index === 0 ? 0 : -overlap,
            borderRadius: '50%',
            border: `2px solid ${palette.surface}`,
            display: 'inline-flex',
            zIndex: visible.length - index,
          }}
        >
          <Avatar name={person.name} src={person.src} size={size} />
        </span>
      ))}
      {hidden > 0 && (
        <span
          style={{
            marginLeft: -overlap,
            width: size + 4,
            height: size + 4,
            borderRadius: '50%',
            background: palette.raised,
            border: `2px solid ${palette.surface}`,
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 600,
            color: palette.text,
          }}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
};
