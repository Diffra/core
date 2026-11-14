import type React from 'react';
import { useRef, useState } from 'react';
import { baseText, palette, radius, tones } from '../../theme';

export interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a divider above the item to group related actions. */
  separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  triggerLabel: string;
  items: MenuItem[];
}

/** Room reserved below the trigger so the open menu is part of the capture. */
const MENU_AREA_HEIGHT = '320px';

const MENU_CSS = `
.dfx-menu-item { font: inherit; }
.dfx-menu-item:focus-visible, .dfx-menu-item:hover:not(:disabled) {
  background: ${palette.raised};
  outline: none;
}
.dfx-menu-item[data-destructive='true']:focus-visible,
.dfx-menu-item[data-destructive='true']:hover:not(:disabled) {
  background: ${tones.danger.bg};
}
.dfx-menu-trigger:focus-visible {
  outline: 2px solid ${palette.accent};
  outline-offset: 2px;
}
`;

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  triggerLabel,
  items,
}) => {
  const [open, setOpen] = useState(false);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusItem = (from: number, step: 1 | -1) => {
    for (let offset = 1; offset <= items.length; offset++) {
      const index = (from + step * offset + items.length * 2) % items.length;
      if (!items[index]?.disabled) {
        itemRefs.current[index]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index, -1);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      style={{
        ...baseText,
        position: 'relative',
        width: '260px',
        minHeight: open ? MENU_AREA_HEIGHT : undefined,
        padding: '16px',
        background: palette.canvas,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.medium,
      }}
    >
      <style>{MENU_CSS}</style>
      <button
        type="button"
        className="dfx-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(-1, 1));
          }
        }}
        style={{
          ...baseText,
          fontSize: '14px',
          fontWeight: 600,
          padding: '8px 14px',
          background: palette.raised,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.small,
          cursor: 'pointer',
        }}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '60px',
            left: '16px',
            width: '228px',
            padding: '6px',
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: radius.medium,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.55)',
            zIndex: 10,
          }}
        >
          {items.map((item, index) => (
            <div key={item.id}>
              {item.separatorBefore && (
                <hr
                  style={{
                    height: '1px',
                    margin: '6px 4px',
                    border: 'none',
                    background: palette.border,
                  }}
                />
              )}
              <button
                type="button"
                role="menuitem"
                className="dfx-menu-item"
                data-destructive={item.destructive ?? false}
                disabled={item.disabled}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                style={{
                  ...baseText,
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  fontSize: '14px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: radius.small,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  color: item.disabled
                    ? palette.textMuted
                    : item.destructive
                      ? tones.danger.fg
                      : palette.text,
                  opacity: item.disabled ? 0.6 : 1,
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span style={{ fontSize: '12px', color: palette.textMuted }}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
