import type React from 'react';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  /** Tooltip, usually the keyboard shortcut. */
  title?: string;
}

export interface SegmentedProps<T extends string> {
  /** Accessible name of the group. */
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (id: T) => void;
}

/**
 * A row of mutually exclusive choices. The chosen one is an ink pill, which is
 * the single selection style across the interface.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 p-0 min-w-0 border-none inline-flex items-center gap-1"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.id)}
            className={`h-10 px-4 gap-2 rounded-full border-none cursor-pointer inline-flex items-center transition-colors ${
              selected
                ? 'bg-ink text-paper'
                : 'bg-transparent text-ink-2 hover:text-ink hover:bg-wash'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
