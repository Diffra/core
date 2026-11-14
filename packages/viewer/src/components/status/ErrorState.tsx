import { AlertCircle } from 'lucide-react';
import type React from 'react';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';

export interface ErrorStateProps {
  error: string;
  remoteUrl?: string | null;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  remoteUrl,
  onRetry,
}) => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-paper text-ink select-none p-6">
      <div className="w-full max-w-lg p-8 flex flex-col items-center gap-6 bg-wash rounded-3xl text-center">
        <div className="w-12 h-12 rounded-full bg-paper text-failed flex items-center justify-center">
          <AlertCircle className={ICON_CLASS} strokeWidth={ICON_STROKE} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-ui-title text-ink">Could not load report</h2>
          {remoteUrl ? (
            <p className="m-0 text-ink-3 break-all">
              Failed to fetch <span className="text-ink-2">{remoteUrl}</span>
            </p>
          ) : null}
        </div>

        <div className="w-full p-4 rounded-2xl bg-paper text-left text-ink-2">
          <span className="text-ink">Details: </span>
          {error}
        </div>

        {remoteUrl ? (
          <p className="m-0 text-left text-ink-3">
            Ensure the remote storage server sends{' '}
            <code className="px-1.5 py-0.5 rounded bg-paper text-ink">
              Access-Control-Allow-Origin: *
            </code>{' '}
            and the URL is reachable.
          </p>
        ) : null}

        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="h-10 px-6 bg-ink text-white rounded-full text-ui-semibold hover:bg-accent transition-colors border-none cursor-pointer"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
};
