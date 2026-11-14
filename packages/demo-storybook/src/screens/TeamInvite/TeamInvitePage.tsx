import type React from 'react';
import { AppFrame, Icon, Logo, Person } from '../../ui';

const OVERLAY_POSITION = { position: 'absolute', inset: 0 } as const;

const INVITES = [
  {
    name: 'Daniel Okafor',
    email: 'daniel@bluepeak.io',
    role: 'Admin',
    color: '#0ea5e9',
  },
  {
    name: 'Priya Raman',
    email: 'priya@bluepeak.io',
    role: 'Editor',
    color: '#ec4899',
  },
  {
    name: 'Tomás Herrera',
    email: 'tomas@bluepeak.io',
    role: 'Viewer',
    color: '#10b981',
  },
];

const Backdrop: React.FC = () => (
  <div
    style={{
      height: '100vh',
      padding: '24px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
    }}
  >
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Logo name="Lumen" />
      <span style={{ display: 'flex', gap: 12 }}>
        <Icon name="bell" size={22} />
        <Person name="Maya Lindqvist" color="#6366f1" size={34} />
      </span>
    </header>
    <h1 style={{ fontSize: 34, fontWeight: 800 }}>Welcome to your workspace</h1>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
      }}
    >
      {['Projects', 'Pull requests', 'Baselines'].map((title) => (
        <div
          key={title}
          style={{
            height: 150,
            padding: 24,
            borderRadius: 20,
            background: '#ffffff',
            border: '1px solid var(--line)',
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
      ))}
    </div>
    <div
      style={{
        flex: 1,
        borderRadius: 20,
        background: '#ffffff',
        border: '1px solid var(--line)',
      }}
    />
  </div>
);

export const TeamInvitePage: React.FC = () => (
  <AppFrame>
    <Backdrop />
    <div
      style={{
        ...OVERLAY_POSITION,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.62)',
      }}
    >
      <div
        role="dialog"
        aria-label="Invite your team"
        style={{
          width: 580,
          padding: 40,
          borderRadius: 28,
          background: '#ffffff',
          boxShadow: '0 40px 90px rgba(15, 23, 42, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div>
          <h2
            style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Invite your team
          </h2>
          <p style={{ marginTop: 8, fontSize: 16, color: 'var(--ink-500)' }}>
            Reviewers get a link to every pull request that changes how your
            product looks.
          </p>
        </div>
        {INVITES.map((invite) => (
          <div
            key={invite.email}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 16,
              border: '1.5px solid var(--line)',
            }}
          >
            <Person name={invite.name} color={invite.color} size={42} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{invite.name}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>
                {invite.email}
              </div>
            </div>
            <span
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                background: 'var(--brand-50)',
                color: 'var(--brand-500)',
              }}
            >
              {invite.role}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '16px 0',
              borderRadius: 14,
              fontSize: 17,
              fontWeight: 800,
              color: '#ffffff',
              background: 'var(--brand-500)',
            }}
          >
            Send 3 invites
          </span>
          <span
            style={{
              padding: '16px 26px',
              borderRadius: 14,
              fontSize: 17,
              fontWeight: 700,
              border: '1.5px solid var(--line)',
            }}
          >
            Skip for now
          </span>
        </div>
      </div>
    </div>
  </AppFrame>
);
