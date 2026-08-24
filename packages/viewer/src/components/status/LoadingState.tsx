import type React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  remoteUrl?: string | null;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ remoteUrl }) => {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-800 select-none text-ui-base p-6">
      <div className="flex flex-col items-center gap-3 p-8 bg-white border border-zinc-200/80 rounded-2xl shadow-xs max-w-md w-full text-center">
        <Loader2 className="w-6 h-6 text-zinc-900 animate-spin" />
        <h2 className="text-ui-heading font-medium text-zinc-900 m-0">
          Loading Visual Regression Report
        </h2>
        {remoteUrl ? (
          <p className="text-ui-base text-zinc-500 m-0 break-all">
            Fetching report data from{' '}
            <span className="font-medium text-zinc-700">{remoteUrl}</span>...
          </p>
        ) : (
          <p className="text-ui-base text-zinc-500 m-0">
            Initializing visual regression report...
          </p>
        )}
      </div>
    </div>
  );
};
