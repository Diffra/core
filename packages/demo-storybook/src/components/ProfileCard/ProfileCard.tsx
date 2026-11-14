import type React from 'react';
import { baseText, palette, panel } from '../../theme';
import { Avatar, type PresenceStatus } from '../Avatar/Avatar';

export interface ProfileCardProps {
  name: string;
  role: string;
  location: string;
  photoSrc?: string;
  presence?: PresenceStatus;
  stats: Array<{ label: string; value: string }>;
  /** Shows a skeleton while the profile loads. */
  loading?: boolean;
}

const SKELETON_CSS = `
@keyframes dfx-profile-pulse {
  from { opacity: 0.35; }
  to { opacity: 0.8; }
}
.dfx-profile-skeleton {
  display: block;
  background: ${palette.border};
  border-radius: 4px;
  animation: dfx-profile-pulse 1.2s ease-in-out infinite alternate;
}
`;

const AVATAR_SIZE = 64;

const Skeleton: React.FC<{
  width: number | string;
  height: number;
  round?: boolean;
}> = ({ width, height, round = false }) => (
  <span
    className="dfx-profile-skeleton"
    style={{ width, height, borderRadius: round ? '50%' : undefined }}
  />
);

export const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  role,
  location,
  photoSrc,
  presence,
  stats,
  loading = false,
}) => (
  <article
    aria-busy={loading}
    style={{
      ...panel,
      width: '100%',
      maxWidth: '360px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}
  >
    <style>{SKELETON_CSS}</style>
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      {loading ? (
        <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} round />
      ) : (
        <Avatar
          name={name}
          src={photoSrc}
          size={AVATAR_SIZE}
          presence={presence}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: 0,
          flexGrow: 1,
        }}
      >
        {loading ? (
          <>
            <Skeleton width="70%" height={18} />
            <Skeleton width="50%" height={14} />
          </>
        ) : (
          <>
            <h3
              style={{
                ...baseText,
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={name}
            >
              {name}
            </h3>
            <span
              style={{
                ...baseText,
                fontSize: '14px',
                color: palette.textMuted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={`${role}, ${location}`}
            >
              {role} · {location}
            </span>
          </>
        )}
      </div>
    </div>
    <dl
      style={{
        margin: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        gap: '12px',
        paddingTop: '16px',
        borderTop: `1px solid ${palette.border}`,
      }}
    >
      {stats.map((stat) => (
        <div key={stat.label} style={{ ...baseText }}>
          <dt style={{ fontSize: '12px', color: palette.textMuted }}>
            {stat.label}
          </dt>
          <dd style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700 }}>
            {loading ? <Skeleton width={36} height={20} /> : stat.value}
          </dd>
        </div>
      ))}
    </dl>
  </article>
);
