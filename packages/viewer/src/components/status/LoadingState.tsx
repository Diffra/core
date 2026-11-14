import { Loader2 } from 'lucide-react';
import type React from 'react';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';

export interface LoadingStateProps {
  remoteUrl?: string | null;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ remoteUrl }) => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-paper text-ink select-none p-6">
      <div className="w-full max-w-md p-8 flex flex-col items-center gap-3 bg-wash rounded-3xl text-center">
        <Loader2
          className={`${ICON_CLASS} text-accent animate-spin`}
          strokeWidth={ICON_STROKE}
        />
        <h2 className="m-0 text-ui-title text-ink">Loading report</h2>
        <p className="m-0 text-ink-3 break-all">
          {remoteUrl ? (
            <>
              Fetching <span className="text-ink-2">{remoteUrl}</span>
            </>
          ) : (
            'Preparing report'
          )}
        </p>
      </div>
    </div>
  );
};
