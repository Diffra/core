import type React from 'react';
import { STATUS_LABEL } from '../../lib/status.js';
import type { TestStatus } from '../../types/index.js';

const DOT_STYLES: Record<TestStatus, string> = {
  failed: 'bg-failed',
  changed: 'bg-changed',
  removed: 'bg-removed',
  added: 'bg-added',
  unchanged: 'bg-unchanged',
};

/** A small coloured dot. Used alone where a word would add noise. */
export const StatusDot: React.FC<{ status: TestStatus }> = ({ status }) => (
  <span
    role="img"
    aria-label={STATUS_LABEL[status]}
    className={`w-2 h-2 rounded-full shrink-0 ${DOT_STYLES[status]}`}
  />
);

export const StatusLabel: React.FC<{ status: TestStatus }> = ({ status }) => (
  <span className="inline-flex items-center gap-2 text-ink-2 shrink-0">
    <StatusDot status={status} />
    {STATUS_LABEL[status]}
  </span>
);
