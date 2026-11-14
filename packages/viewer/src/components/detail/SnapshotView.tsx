import { CircleAlert, CircleCheck, ImageOff } from 'lucide-react';
import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { ICON_STROKE } from '../../tokens/icon.js';
import { DiffHighlightView } from '../stage/views/DiffHighlightView.js';
import { FadeView } from '../stage/views/FadeView.js';
import { SingleView } from '../stage/views/SingleView.js';
import { SlideView } from '../stage/views/SlideView.js';
import { SplitView } from '../stage/views/SplitView.js';
import { Message } from '../ui/Message.js';

/** Larger than body icons: they carry an empty state on their own. */
const glyph = { className: 'w-8 h-8', strokeWidth: ICON_STROKE };

/** Picks what to draw for the active snapshot, including the empty cases. */
export const SnapshotView: React.FC = () => {
  const { activeStory, mode } = useViewer();
  if (!activeStory) return null;
  const { status, baselineUrl, candidateUrl, error, name } = activeStory;

  if (status === 'failed') {
    return (
      <Message icon={<CircleAlert {...glyph} />} title="Capture failed">
        {error ?? 'No screenshot was produced for this snapshot.'}
      </Message>
    );
  }
  if (candidateUrl && !baselineUrl) {
    return (
      <SingleView
        src={candidateUrl}
        alt={`${name} candidate`}
        note="New snapshot, no baseline yet"
      />
    );
  }
  if (baselineUrl && !candidateUrl) {
    return (
      <SingleView
        src={baselineUrl}
        alt={`${name} baseline`}
        note="Removed, no candidate"
      />
    );
  }
  if (!baselineUrl || !candidateUrl) {
    return status === 'unchanged' ? (
      <Message icon={<CircleCheck {...glyph} />} title="No visual changes">
        This snapshot matches its baseline.
      </Message>
    ) : (
      <Message icon={<ImageOff {...glyph} />} title="No images">
        This snapshot has no images to show.
      </Message>
    );
  }

  switch (mode) {
    case 'split':
      return <SplitView />;
    case 'slide':
      return <SlideView />;
    case 'fade':
      return <FadeView />;
    default:
      return <DiffHighlightView />;
  }
};
