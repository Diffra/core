import type React from 'react';
import { AppFrame, Icon, Logo } from '../../ui';
import { productPhoto } from '../../ui/art';

const PAY_BUTTON_BACKGROUND = 'var(--brand-500)';

const ORDER = [
  {
    name: 'Oslo lounge chair',
    detail: 'Oat linen · Qty 1',
    price: '$189.00',
    photo: productPhoto('#fcd34d', '#f97316', 'chair'),
  },
  {
    name: 'Arc table lamp',
    detail: 'Brushed brass · Qty 1',
    price: '$35.00',
    photo: productPhoto('#a5b4fc', '#6366f1', 'lamp'),
  },
];

const STEPS = [
  { label: 'Cart', done: true },
  { label: 'Shipping', done: true },
  { label: 'Payment', done: false },
];

const FieldBox: React.FC<{ label: string; value: string; icon?: boolean }> = ({
  label,
  value,
  icon = false,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-700)' }}>
      {label}
    </span>
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        fontSize: 16,
        background: '#ffffff',
        border: '1.5px solid var(--ink-300)',
        borderRadius: 12,
      }}
    >
      {icon && <Icon name="lock" size={18} color="var(--ink-500)" />}
      {value}
    </div>
  </div>
);

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong = false,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: strong ? 20 : 15,
      fontWeight: strong ? 800 : 500,
      color: strong ? 'var(--ink-900)' : 'var(--ink-700)',
    }}
  >
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

export const CheckoutPage: React.FC = () => (
  <AppFrame>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 56px',
        background: '#ffffff',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Logo name="Terrace" />
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          listStyle: 'none',
          margin: 0,
          padding: 0,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {STEPS.map((step) => (
          <li
            key={step.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: step.done ? 'var(--success)' : 'var(--brand-500)',
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                background: step.done ? 'var(--success)' : 'var(--brand-500)',
              }}
            >
              {step.done ? <Icon name="check" size={15} strokeWidth={3} /> : 3}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 14,
          color: 'var(--ink-500)',
        }}
      >
        <Icon name="lock" size={16} /> Secure checkout
      </span>
    </header>

    <main
      style={{
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        gap: 40,
        maxWidth: 1180,
        margin: '0 auto',
        padding: '44px 56px',
      }}
    >
      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--line)',
          borderRadius: 24,
          padding: 36,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Payment details
        </h1>
        <div style={{ display: 'flex', gap: 12 }}>
          {['Card', 'PayPal', 'Apple Pay'].map((method, index) => (
            <span
              key={method}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 12,
                border: `2px solid ${index === 0 ? 'var(--brand-500)' : 'var(--line)'}`,
                background: index === 0 ? 'var(--brand-50)' : '#ffffff',
                color: index === 0 ? 'var(--brand-500)' : 'var(--ink-500)',
              }}
            >
              {method}
            </span>
          ))}
        </div>
        <FieldBox label="Card number" value="4242 4242 4242 4242" icon />
        <FieldBox label="Name on card" value="Maya Lindqvist" />
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <FieldBox label="Expiry" value="08 / 29" />
          <FieldBox label="CVC" value="•••" />
        </div>
        <button
          type="button"
          style={{
            width: '100%',
            height: 64,
            marginTop: 6,
            border: 'none',
            borderRadius: 16,
            fontSize: 20,
            fontWeight: 800,
            color: '#ffffff',
            background: PAY_BUTTON_BACKGROUND,
            boxShadow: '0 12px 28px rgba(79, 70, 229, 0.38)',
            cursor: 'pointer',
          }}
        >
          Pay $248.00
        </button>
      </section>

      <aside
        style={{
          alignSelf: 'start',
          background: '#ffffff',
          border: '1px solid var(--line)',
          borderRadius: 24,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Order summary</h2>
        {ORDER.map((item) => (
          <div
            key={item.name}
            style={{ display: 'flex', gap: 16, alignItems: 'center' }}
          >
            <img
              src={item.photo}
              alt=""
              width={72}
              height={72}
              style={{ borderRadius: 14, objectFit: 'cover' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>
                {item.detail}
              </div>
            </div>
            <strong style={{ fontSize: 16 }}>{item.price}</strong>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingTop: 20,
            borderTop: '1px solid var(--line)',
          }}
        >
          <Row label="Subtotal" value="$224.00" />
          <Row label="Shipping" value="$12.00" />
          <Row label="Tax" value="$12.00" />
          <Row label="Total" value="$248.00" strong />
        </div>
      </aside>
    </main>
  </AppFrame>
);
