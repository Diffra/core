import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef } from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';
import { SearchField } from '../ui/SearchField.js';
import { StatusDot, StatusLabel } from '../ui/Status.js';

/**
 * The title of the snapshot, which is also a quick switcher: click it, or
 * press `/`, to search and jump to any snapshot without going back.
 */
export const SnapshotSwitcher: React.FC = () => {
  const { activeStory, groups, query, setQuery, openSnapshot, searchTick } =
    useViewer();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') input.current?.focus();
    };
    element.addEventListener('toggle', onToggle);
    return () => element.removeEventListener('toggle', onToggle);
  }, []);

  useEffect(() => {
    const element = panel.current;
    if (searchTick > 0 && element && !element.matches(':popover-open')) {
      element.showPopover();
    }
  }, [searchTick]);

  if (!activeStory) return null;

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        title="Switch snapshot (/)"
        className="group min-w-0 p-0 flex flex-col gap-1 text-left bg-transparent border-none cursor-pointer"
      >
        <span className="flex items-center gap-4 text-ink-3">
          <span className="truncate">{activeStory.component}</span>
          <StatusLabel status={activeStory.status} />
        </span>
        <span className="flex items-center gap-3 min-w-0 text-ui-display text-ink">
          <span className="truncate">{activeStory.name}</span>
          <ChevronDown
            className={`${ICON_CLASS} text-ink-3 group-hover:text-ink transition-colors`}
            strokeWidth={ICON_STROKE}
          />
        </span>
      </button>

      <div
        id={id}
        ref={panel}
        popover="auto"
        className="p-4 rounded-3xl border-none bg-paper text-ink outline outline-ink/10 backdrop:bg-transparent"
        style={{
          position: 'fixed',
          inset: '7rem auto auto 5.5rem',
          margin: 0,
          width: '26rem',
          maxHeight: 'calc(100vh - 9rem)',
          overflowY: 'auto',
        }}
      >
        <div className="flex flex-col gap-4">
          <SearchField
            value={query}
            onChange={setQuery}
            inputRef={input}
            hint={false}
          />
          {groups.length === 0 ? (
            <p className="m-0 px-2 text-ink-3">No snapshots match.</p>
          ) : (
            groups.map((group) => (
              <section key={group.component} className="flex flex-col gap-0.5">
                <h2 className="m-0 h-8 px-4 flex items-center text-ui-label text-ink-3">
                  {group.component}
                </h2>
                {group.items.map((item) => {
                  const current = item.id === activeStory.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={current ? 'page' : undefined}
                      onClick={() => {
                        openSnapshot(item.id);
                        panel.current?.hidePopover();
                      }}
                      className={`h-10 px-4 gap-3 flex items-center justify-between text-left rounded-full border-none cursor-pointer transition-colors ${
                        current
                          ? 'bg-ink text-paper'
                          : 'bg-transparent text-ink-2 hover:text-ink hover:bg-wash'
                      }`}
                    >
                      <span className="truncate">{item.name}</span>
                      <StatusDot status={item.status} />
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
};
