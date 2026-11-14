import { Keyboard } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef } from 'react';
import { SHORTCUT_GROUPS } from '../../lib/shortcuts.js';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';
import { IconButton } from '../ui/IconButton.js';
import { Kbd } from '../ui/Kbd.js';

/** A button that opens the shortcut list. The `?` key opens it too. */
export const ShortcutsHelp: React.FC = () => {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      panel.current?.togglePopover();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <IconButton
        popoverTarget={id}
        icon={<Keyboard className={ICON_CLASS} strokeWidth={ICON_STROKE} />}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      />

      <div
        id={id}
        ref={panel}
        popover="auto"
        className="p-6 rounded-3xl border-none bg-paper text-ink outline outline-ink/10 backdrop:bg-transparent"
        style={{
          position: 'fixed',
          inset: '5rem 2.5rem auto auto',
          margin: 0,
          width: '22rem',
          maxHeight: 'calc(100vh - 7rem)',
          overflowY: 'auto',
        }}
      >
        <div className="flex flex-col gap-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-3">
              <h2 className="m-0 text-ui-label text-ink-3">{group.title}</h2>
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.label}
                    className="flex items-center justify-between gap-4 text-ink-2"
                  >
                    <span>{shortcut.label}</span>
                    <span className="flex gap-1 shrink-0">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
};
