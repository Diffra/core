import type React from 'react';
import { AppFrame, Icon } from '../../ui';
import { productPhoto } from '../../ui/art';

const TITLE_WRAP = 'normal' as const;

const DEALS = [
  {
    title: 'Wireless noise-cancelling headphones Pro Max',
    price: '$129',
    was: '$229',
    photo: productPhoto('#c4b5fd', '#7c3aed', 'bottle'),
  },
  {
    title: 'Everyday leather weekender bag, large',
    price: '$89',
    was: '$149',
    photo: productPhoto('#fdba74', '#ea580c', 'bag'),
  },
  {
    title: 'Aero running shoe, limited colourway',
    price: '$74',
    was: '$120',
    photo: productPhoto('#7dd3fc', '#0284c7', 'shoe'),
  },
];

export const MobileShopScreen: React.FC = () => (
  <AppFrame
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background:
        'linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #f97316 100%)',
    }}
  >
    <div
      style={{
        width: 392,
        height: 740,
        padding: 10,
        borderRadius: 54,
        background: '#0b1020',
        boxShadow: '0 40px 80px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 44,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '16px 28px 8px',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          <span>9:41</span>
          <span>100%</span>
        </div>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 22px 14px',
          }}
        >
          <span
            style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Terrace
          </span>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Icon name="bag" size={26} />
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                background: '#db2777',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              3
            </span>
          </span>
        </header>

        <div
          style={{
            margin: '0 18px',
            padding: 22,
            borderRadius: 24,
            color: '#ffffff',
            background: 'linear-gradient(135deg, #7c3aed, #db2777)',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.08em',
              opacity: 0.85,
            }}
          >
            BLACK FRIDAY
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 38,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            40% off everything
          </div>
          <span
            style={{
              display: 'inline-block',
              marginTop: 14,
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 800,
              background: 'rgba(255,255,255,0.22)',
            }}
          >
            Code FRIDAY40
          </span>
        </div>

        <h2
          style={{ padding: '22px 22px 10px', fontSize: 20, fontWeight: 800 }}
        >
          Deals ending soon
        </h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: '0 18px',
          }}
        >
          {DEALS.map((deal) => (
            <div
              key={deal.title}
              style={{ display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <img
                src={deal.photo}
                alt=""
                width={64}
                height={64}
                style={{ borderRadius: 16, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    whiteSpace: TITLE_WRAP,
                  }}
                >
                  {deal.title}
                </div>
                <div style={{ marginTop: 4, fontSize: 15 }}>
                  <strong style={{ color: '#db2777' }}>{deal.price}</strong>{' '}
                  <span
                    style={{
                      color: 'var(--ink-500)',
                      textDecoration: 'line-through',
                    }}
                  >
                    {deal.was}
                  </span>
                </div>
              </div>
              <span
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#ffffff',
                  background: '#0f172a',
                }}
              >
                Add
              </span>
            </div>
          ))}
        </div>

        <nav
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-around',
            padding: '14px 0 22px',
            borderTop: '1px solid var(--line)',
            color: 'var(--ink-500)',
          }}
        >
          <Icon name="home" size={26} color="#0f172a" />
          <Icon name="search" size={26} />
          <Icon name="bag" size={26} />
          <Icon name="users" size={26} />
        </nav>
      </div>
    </div>
  </AppFrame>
);
