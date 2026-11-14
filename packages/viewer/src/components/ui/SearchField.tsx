import { Search, X } from 'lucide-react';
import type React from 'react';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';
import { Kbd } from './Kbd.js';

const iconProps = { className: ICON_CLASS, strokeWidth: ICON_STROKE };

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
  /** Show the `/` key hint while the field is empty. */
  hint?: boolean;
}

/** A pill-shaped search field. */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  inputRef,
  className = '',
  hint = true,
}) => (
  <label
    className={`h-11 pl-4 pr-3 gap-3 flex items-center rounded-full bg-wash text-ink-3 focus-within:outline-2 focus-within:outline-accent ${className}`}
  >
    <Search {...iconProps} />
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search snapshots"
      aria-label="Search snapshots"
      className="flex-1 min-w-0 h-full bg-transparent border-none text-ink placeholder:text-ink-3 focus-visible:outline-none"
    />
    {value ? (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="w-6 h-6 rounded-full border-none bg-transparent text-ink-3 hover:text-ink cursor-pointer flex items-center justify-center"
      >
        <X {...iconProps} />
      </button>
    ) : hint ? (
      <Kbd className="bg-paper">/</Kbd>
    ) : null}
  </label>
);
