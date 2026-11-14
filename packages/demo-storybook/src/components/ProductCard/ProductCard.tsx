import type React from 'react';
import { useState } from 'react';
import { palette, panel, radius, tones } from '../../theme';

export interface ProductCardProps {
  name: string;
  /** Price in whole dollars. */
  price: number;
  salePrice?: number;
  imageSrc: string;
  rating?: number;
  reviewCount?: number;
  soldOut?: boolean;
}

const PHOTO_HEIGHT = '200px';
const STAR_POSITIONS = [1, 2, 3, 4, 5];

const Star: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 20 20"
    aria-hidden="true"
    fill={filled ? palette.warning : 'none'}
    stroke={palette.warning}
    strokeWidth="1.5"
    strokeLinejoin="round"
  >
    <path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7L10 2.5Z" />
  </svg>
);

const PhotoFallback: React.FC = () => (
  <div
    role="img"
    aria-label="Product photo unavailable"
    style={{
      height: PHOTO_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      background: palette.raised,
      color: palette.textMuted,
      fontSize: '13px',
    }}
  >
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
    Photo unavailable
  </div>
);

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  salePrice,
  imageSrc,
  rating,
  reviewCount,
  soldOut = false,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const onSale = salePrice !== undefined && !soldOut;
  const roundedRating = Math.round(rating ?? 0);

  return (
    <article
      style={{
        ...panel,
        position: 'relative',
        width: '100%',
        maxWidth: '300px',
        overflow: 'hidden',
      }}
    >
      {imageFailed ? (
        <PhotoFallback />
      ) : (
        <img
          src={imageSrc}
          alt={name}
          onError={() => setImageFailed(true)}
          style={{
            display: 'block',
            width: '100%',
            height: PHOTO_HEIGHT,
            objectFit: 'cover',
            opacity: soldOut ? 0.4 : 1,
          }}
        />
      )}
      {onSale && (
        <span
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#ffffff',
            background: palette.danger,
            borderRadius: radius.pill,
          }}
        >
          Sale
        </span>
      )}
      {soldOut && (
        <span
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 700,
            color: palette.text,
            background: palette.raised,
            border: `1px solid ${palette.border}`,
            borderRadius: radius.pill,
          }}
        >
          Sold out
        </span>
      )}
      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            lineHeight: 1.35,
            color: soldOut ? palette.textMuted : palette.text,
          }}
        >
          {name}
        </h3>
        {rating !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '13px',
              color: palette.textMuted,
            }}
          >
            {STAR_POSITIONS.map((position) => (
              <Star key={position} filled={position <= roundedRating} />
            ))}
            {reviewCount !== undefined && (
              <span style={{ marginLeft: '6px' }}>({reviewCount})</span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: onSale ? tones.danger.fg : palette.text,
            }}
          >
            ${onSale ? salePrice : price}
          </span>
          {onSale && (
            <span
              style={{
                fontSize: '14px',
                color: palette.textMuted,
                textDecoration: 'line-through',
              }}
            >
              ${price}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
