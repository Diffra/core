import type React from 'react';
import { AlertCircle } from 'lucide-react';

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
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-800 select-none text-ui-base p-6">
      <div className="flex flex-col items-center gap-4 p-8 bg-white border border-rose-200 rounded-2xl shadow-xs max-w-lg w-full text-center">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-ui-heading font-medium text-zinc-900 m-0">
            Could not load report
          </h2>
          {remoteUrl ? (
            <p className="text-ui-base text-zinc-600 mt-1 mb-0 break-all">
              Failed to fetch report from{' '}
              <span className="font-medium">{remoteUrl}</span>
            </p>
          ) : null}
        </div>

        <div className="p-3 bg-zinc-50 rounded-xl text-left w-full text-zinc-700 text-ui-base border border-zinc-200/60">
          <span className="font-medium text-zinc-900">Details: </span>
          {error}
        </div>

        {remoteUrl ? (
          <p className="text-ui-base text-zinc-500 m-0 text-left">
            Ensure the remote storage server enables{' '}
            <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">
              Access-Control-Allow-Origin: *
            </code>{' '}
            (CORS) and the URL is reachable.
          </p>
        ) : null}

        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-ui-medium font-medium hover:bg-zinc-800 transition-colors border-none cursor-pointer"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
};
