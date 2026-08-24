import { useEffect, useState } from 'react';
import type { TestRunReport } from '../types/index.js';

export interface ReportLoaderState {
  status: 'loading' | 'ready' | 'error' | 'empty';
  data: TestRunReport | null;
  error: string | null;
  remoteUrl: string | null;
  retry: () => void;
}

export function useReportLoader(
  initialData?: TestRunReport,
): ReportLoaderState {
  const [data, setData] = useState<TestRunReport | null>(initialData || null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>(
    initialData ? 'ready' : 'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const retry = () => {
    setReloadTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setStatus('ready');
      return;
    }

    let isMounted = true;

    async function loadReport() {
      // 1. Check for remote report URL in query params
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const queryUrl =
          params.get('report') ||
          params.get('reportUrl') ||
          params.get('reporturl') ||
          params.get('url') ||
          params.get('data');

        if (queryUrl) {
          if (!isMounted) return;
          setRemoteUrl(queryUrl);
          setStatus('loading');
          setError(null);

          try {
            const response = await fetch(queryUrl);
            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status} ${response.statusText}`,
              );
            }
            const json = (await response.json()) as TestRunReport;
            if (!isMounted) return;
            setData(json);
            setStatus('ready');
            return;
          } catch (err) {
            if (!isMounted) return;
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus('error');
            return;
          }
        }
      }

      // 2. Check for inline JSON script tag
      if (typeof document !== 'undefined') {
        const scriptEl = document.getElementById('diffra-data');
        if (scriptEl?.textContent) {
          try {
            const json = JSON.parse(scriptEl.textContent) as TestRunReport;
            if (!isMounted) return;
            setData(json);
            setStatus('ready');
            return;
          } catch (err) {
            if (!isMounted) return;
            const message = err instanceof Error ? err.message : String(err);
            setError(`Failed to parse embedded report JSON: ${message}`);
            setStatus('error');
            return;
          }
        }
      }

      // 3. Check for window globals
      if (typeof window !== 'undefined') {
        const win = window as unknown as {
          __DIFFRA_DATA__?: TestRunReport;
          __SYNDETIC_DATA__?: TestRunReport;
        };
        const globalData = win.__DIFFRA_DATA__ || win.__SYNDETIC_DATA__;
        if (globalData) {
          if (!isMounted) return;
          setData(globalData);
          setStatus('ready');
          return;
        }
      }

      // 4. Standby when no report was provided
      if (!isMounted) return;
      setStatus('empty');
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [initialData, reloadTrigger]);

  return { status, data, error, remoteUrl, retry };
}
