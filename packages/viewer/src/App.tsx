import type React from 'react';
import { AppLayout } from './components/layout/AppLayout.js';
import { ErrorState } from './components/status/ErrorState.js';
import { LoadingState } from './components/status/LoadingState.js';
import { StandbyState } from './components/status/StandbyState.js';
import { ViewerProvider } from './context/ViewerContext.js';
import { useReportLoader } from './hooks/useReportLoader.js';
import './tokens/theme.css';
import type { TestRunReport } from './types/index.js';

export interface AppProps {
  manifest?: TestRunReport;
  initialData?: TestRunReport;
}

export const App: React.FC<AppProps> = ({ manifest, initialData }) => {
  const { status, data, error, remoteUrl, retry } = useReportLoader(
    manifest || initialData,
  );

  if (status === 'loading') {
    return <LoadingState remoteUrl={remoteUrl} />;
  }

  if (status === 'error' && error) {
    return <ErrorState error={error} remoteUrl={remoteUrl} onRetry={retry} />;
  }

  if (status === 'empty' || !data) {
    return <StandbyState />;
  }

  return (
    <ViewerProvider manifest={data}>
      <AppLayout />
    </ViewerProvider>
  );
};
