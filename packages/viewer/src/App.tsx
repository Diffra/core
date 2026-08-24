import type React from 'react';
import { AppLayout } from './components/layout/AppLayout.js';
import { ViewerProvider } from './context/ViewerContext.js';
import './tokens/theme.css';
import type { TestRunReport } from './types/index.js';

export interface AppProps {
  manifest: TestRunReport;
}

export const App: React.FC<AppProps> = ({ manifest }) => {
  return (
    <ViewerProvider manifest={manifest}>
      <AppLayout />
    </ViewerProvider>
  );
};
