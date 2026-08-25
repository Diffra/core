import type React from 'react';

export interface ModalProps {
  title: string;
  body?: string;
  children?: React.ReactNode;
  isOpen?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  body,
  children,
  isOpen = true,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'rgba(0, 0, 0, 0.65)',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '10px',
          width: '440px',
          padding: '24px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#f0f6fc',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          {title}
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: '#8b949e',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {children || body}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              background: '#21262d',
              color: '#c9d1d9',
              cursor: 'pointer',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #0969da',
              background: '#0969da',
              color: '#ffffff',
              cursor: 'pointer',
            }}
            onClick={onConfirm}
          >
            Approve All
          </button>
        </div>
      </div>
    </div>
  );
};
