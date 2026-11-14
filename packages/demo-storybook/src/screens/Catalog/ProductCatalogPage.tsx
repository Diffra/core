import type React from 'react';
import { AppFrame, Icon, Logo } from '../../ui';
import { type ProductKind, productPhoto } from '../../ui/art';

const GRID_COLUMNS = 'repeat(3, minmax(0, 1fr))';

interface Product {
  name: string;
  price: string;
  kind: ProductKind;
  from: string;
  to: string;
  tag?: string;
  rating: number;
}

const PRODUCTS: Product[] = [
  {
    name: 'Oslo lounge chair',
    price: '$189',
    kind: 'chair',
    from: '#fcd34d',
    to: '#f97316',
    tag: 'Best seller',
    rating: 5,
  },
  {
    name: 'Arc table lamp',
    price: '$59',
    kind: 'lamp',
    from: '#a5b4fc',
    to: '#6366f1',
    rating: 4,
  },
  {
    name: 'Trail insulated bottle',
    price: '$34',
    kind: 'bottle',
    from: '#6ee7b7',
    to: '#059669',
    tag: 'New',
    rating: 5,
  },
  {
    name: 'Weekender tote',
    price: '$96',
    kind: 'bag',
    from: '#fda4af',
    to: '#e11d48',
    rating: 4,
  },
  {
    name: 'Field automatic watch',
    price: '$240',
    kind: 'watch',
    from: '#93c5fd',
    to: '#2563eb',
    tag: '-20%',
    rating: 5,
  },
  {
    name: 'Aero running shoe',
    price: '$118',
    kind: 'shoe',
    from: '#d8b4fe',
    to: '#9333ea',
    rating: 4,
  },
];

const CATEGORIES = [
  'All',
  'Home',
  'Outdoors',
  'Travel',
  'Accessories',
  'Footwear',
];

export const ProductCatalogPage: React.FC = () => (
  <AppFrame>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        padding: '18px 56px',
        background: '#ffffff',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Logo name="Terrace" />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 48,
          padding: '0 18px',
          borderRadius: 14,
          background: 'var(--page)',
          color: 'var(--ink-500)',
          fontSize: 16,
        }}
      >
        <Icon name="search" size={20} /> Search 2,400 products
      </div>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Icon name="bag" size={26} />
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -10,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            background: 'var(--brand-500)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          2
        </span>
      </span>
    </header>

    <main style={{ padding: '36px 56px 48px' }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }}>
        Autumn collection
      </h1>
      <div style={{ display: 'flex', gap: 12, margin: '22px 0 30px' }}>
        {CATEGORIES.map((category, index) => (
          <span
            key={category}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 700,
              color: index === 0 ? '#ffffff' : 'var(--ink-700)',
              background: index === 0 ? 'var(--ink-900)' : '#ffffff',
              border: '1px solid var(--line)',
            }}
          >
            {category}
          </span>
        ))}
      </div>

      <section
        style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 28 }}
      >
        {PRODUCTS.map((product) => (
          <article
            key={product.name}
            style={{
              borderRadius: 24,
              overflow: 'hidden',
              background: '#ffffff',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={productPhoto(product.from, product.to, product.kind)}
                alt={product.name}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 260,
                  objectFit: 'cover',
                }}
              />
              {product.tag && (
                <span
                  style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    padding: '6px 14px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 800,
                    background: '#ffffff',
                  }}
                >
                  {product.tag}
                </span>
              )}
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>
                  {product.name}
                </h2>
                <strong style={{ fontSize: 20 }}>{product.price}</strong>
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Icon
                    key={star}
                    name="star"
                    size={17}
                    strokeWidth={1.6}
                    color={star <= product.rating ? '#f59e0b' : '#cbd5e1'}
                  />
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  </AppFrame>
);
