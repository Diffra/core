import type React from 'react';
import { FileText } from 'lucide-react';

export const StandbyState: React.FC = () => {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-800 select-none text-ui-base p-6">
      <div className="flex flex-col items-center gap-4 p-8 bg-white border border-zinc-200/80 rounded-2xl shadow-xs max-w-lg w-full text-center">
        <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-ui-heading font-medium text-zinc-900 m-0">
            Diffra Visual Report Viewer
          </h2>
          <p className="text-ui-base text-zinc-500 mt-1 mb-0">
            No visual regression report is currently loaded.
          </p>
        </div>

        <div className="p-4 bg-zinc-50 rounded-xl text-left w-full text-ui-base text-zinc-700 border border-zinc-200/60">
          <span className="font-medium text-zinc-900 block mb-1">
            To view a report:
          </span>
          Pass the report JSON URL in the browser address bar:
          <code className="block mt-2 p-2 bg-white rounded-lg border border-zinc-200/80 text-zinc-800 break-all font-sans text-ui-base">
            ?report=https://example.com/report.json
          </code>
        </div>
      </div>
    </div>
  );
};
