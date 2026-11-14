import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Link,
} from 'lucide-react';
import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { useCopyLink } from '../../hooks/useCopyLink.js';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';
import { ShortcutsHelp } from '../layout/ShortcutsHelp.js';
import { IconButton } from '../ui/IconButton.js';
import { SnapshotSwitcher } from './SnapshotSwitcher.js';

const iconProps = { className: ICON_CLASS, strokeWidth: ICON_STROKE };

/** Where you are, how to move between snapshots, and how to share this one. */
export const TopBar: React.FC = () => {
  const { position, ordered, stepSnapshot, openOverview } = useViewer();
  const { copied, copy } = useCopyLink();

  return (
    <header className="flex items-center justify-between gap-6 select-none">
      <div className="flex items-center gap-5 min-w-0">
        <IconButton
          variant="outline"
          icon={<ArrowLeft {...iconProps} />}
          onClick={openOverview}
          title="Back to overview (o)"
          aria-label="Back to overview"
        />
        <SnapshotSwitcher />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {position >= 0 ? (
          <span className="mr-3 text-ink-3 tabular-nums">
            {position + 1} / {ordered.length}
          </span>
        ) : null}
        <IconButton
          icon={<ChevronLeft {...iconProps} />}
          onClick={() => stepSnapshot(-1)}
          disabled={ordered.length < 2}
          title="Previous snapshot (k)"
          aria-label="Previous snapshot"
        />
        <IconButton
          icon={<ChevronRight {...iconProps} />}
          onClick={() => stepSnapshot(1)}
          disabled={ordered.length < 2}
          title="Next snapshot (j)"
          aria-label="Next snapshot"
        />
        <IconButton
          className="ml-2"
          icon={copied ? <Check {...iconProps} /> : <Link {...iconProps} />}
          label={copied ? 'Copied' : 'Copy link'}
          active={copied}
          onClick={copy}
          title="Copy a link to this snapshot and view"
        />
        <ShortcutsHelp />
      </div>
    </header>
  );
};
