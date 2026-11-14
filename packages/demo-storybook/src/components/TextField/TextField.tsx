import type React from 'react';
import { useId } from 'react';
import { baseText, palette, panel, radius, tones } from '../../theme';

export interface TextFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  helperText?: string;
  /** Validation message. Replaces the helper text and turns the field red. */
  error?: string;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password';
}

const FIELD_CSS = `
.dfx-field input {
  font: inherit;
  font-size: 15px;
  color: ${palette.text};
  background: ${palette.canvas};
  border: 1px solid ${palette.border};
  border-radius: ${radius.small};
  padding: 10px 12px;
  outline: none;
}
.dfx-field input::placeholder { color: ${palette.textMuted}; }
.dfx-field input:focus-visible {
  border-color: ${palette.accent};
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.35);
}
.dfx-field input[aria-invalid='true'] { border-color: ${palette.danger}; }
.dfx-field input[aria-invalid='true']:focus-visible {
  box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.35);
}
.dfx-field input:disabled {
  background: ${palette.raised};
  color: ${palette.textMuted};
  cursor: not-allowed;
}
`;

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  placeholder,
  helperText,
  error,
  disabled = false,
  type = 'text',
}) => {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? helperText;

  return (
    <div
      className="dfx-field"
      style={{
        ...panel,
        width: '100%',
        maxWidth: '360px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <style>{FIELD_CSS}</style>
      <label
        htmlFor={id}
        style={{ ...baseText, fontSize: '14px', fontWeight: 600 }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? messageId : undefined}
      />
      {message && (
        <span
          id={messageId}
          role={error ? 'alert' : undefined}
          style={{
            ...baseText,
            fontSize: '13px',
            color: error ? tones.danger.fg : palette.textMuted,
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
};
