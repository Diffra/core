import { FileText } from 'lucide-react';
import type React from 'react';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';

export const StandbyState: React.FC = () => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-paper text-ink select-none p-6">
      <div className="w-full max-w-lg p-8 flex flex-col items-center gap-6 bg-wash rounded-3xl text-center">
        <div className="w-12 h-12 rounded-full bg-paper text-ink flex items-center justify-center">
          <FileText className={ICON_CLASS} strokeWidth={ICON_STROKE} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-ui-title text-ink">Diffra report viewer</h2>
          <p className="m-0 text-ink-3">No report is loaded.</p>
        </div>

        <div className="w-full p-4 rounded-2xl bg-paper text-left text-ink-2">
          <span className="block mb-2 text-ink">To view a report</span>
          Pass the report JSON URL in the address bar:
          <code className="block mt-2 p-3 bg-wash rounded-xl text-ink break-all">
            ?report=https://example.com/report.json
          </code>
        </div>
      </div>
    </div>
  );
};
