import { CircleAlert, CircleCheck } from 'lucide-react';
import type React from 'react';
import { ICON_STROKE } from '../../tokens/icon.js';
import type { TestResult } from '../../types/index.js';
import { StatusLabel } from '../ui/Status.js';

const glyph = { className: 'w-8 h-8', strokeWidth: ICON_STROKE };

/** What the thumbnail shows when there is no image to show. */
const Placeholder: React.FC<{ status: TestResult['status'] }> = ({
  status,
}) => (
  <span className="flex flex-col items-center gap-3 text-ink-3">
    {status === 'failed' ? (
      <>
        <CircleAlert {...glyph} />
        Capture failed
      </>
    ) : (
      <>
        <CircleCheck {...glyph} />
        No change
      </>
    )}
  </span>
);

/**
 * One snapshot. The thumbnail shows the real interface, and hovering reveals
 * what changed, so a reviewer can triage without opening anything.
 */
export const SnapshotCard: React.FC<{
  item: TestResult;
  onOpen: (id: string) => void;
}> = ({ item, onOpen }) => {
  const shown = item.candidateUrl || item.baselineUrl;
  const revealed = item.diffUrl && item.candidateUrl ? item.diffUrl : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="group w-full p-0 flex flex-col gap-4 text-left bg-transparent border-none cursor-pointer"
      >
        <div className="relative aspect-4/3 rounded-3xl canvas-backdrop overflow-hidden flex items-center justify-center outline-2 outline-transparent transition-[outline-color] group-hover:outline-ink group-focus-visible:outline-ink">
          {shown ? (
            <>
              <img
                src={shown}
                alt=""
                loading="lazy"
                className="max-w-full max-h-full object-contain p-6"
              />
              {revealed ? (
                <img
                  src={revealed}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-contain p-6 bg-paper opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              ) : null}
            </>
          ) : (
            <Placeholder status={item.status} />
          )}
        </div>
        <div className="px-1 flex items-center justify-between gap-4">
          <span className="min-w-0 truncate text-ui-label text-ink">
            {item.name}
            {item.viewport.name !== 'default' ? (
              <span className="ml-2 font-normal text-ink-3">
                {item.viewport.name}
              </span>
            ) : null}
          </span>
          <StatusLabel status={item.status} />
        </div>
      </button>
    </li>
  );
};
