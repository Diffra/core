import { useEffect, useState } from 'react';
import type { TestRunReport } from '../types/index.js';

declare global {
  interface Window {
    __DIFFRA_DATA__?: unknown;
  }
}

export interface ReportLoaderState {
  status: 'loading' | 'ready' | 'error' | 'empty';
  data: TestRunReport | null;
  error: string | null;
  remoteUrl: string | null;
  retry: () => void;
}

export interface RawGitContext {
  branch?: string;
  commit?: string;
  baselineCommit?: string;
  baselineBranch?: string;
  repositoryUrl?: string;
}

export interface RawDiffResult {
  diffPercentage?: number;
  diffCount?: number;
  boundingBoxes?: Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>;
}

export interface RawImageArtifact {
  path?: string;
  url?: string;
}

export interface RawTestResult {
  id?: string;
  name?: string;
  group?: string;
  component?: string;
  status?: 'added' | 'changed' | 'removed' | 'unchanged';
  diffPercentage?: number;
  diffCount?: number;
  viewport?: {
    name?: string;
    width: number;
    height: number;
  };
  candidateUrl?: string;
  candidatePath?: string;
  candidate?: RawImageArtifact;
  baselineUrl?: string;
  baselinePath?: string;
  baseline?: RawImageArtifact;
  diffUrl?: string;
  diffPath?: string;
  diffImage?: RawImageArtifact;
  diff?: RawDiffResult;
  diffResult?: RawDiffResult;
  boundingBoxes?: Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>;
}

export interface RawTestRunReport {
  runId?: string;
  timestamp?: string;
  git?: RawGitContext;
  branch?: string;
  commit?: string;
  baselineCommit?: string;
  baselineBranch?: string;
  repositoryUrl?: string;
  links?: {
    baselineReport?: string;
    branchLatest?: string;
  };
  baselineReportUrl?: string;
  branchLatestUrl?: string;
  summary?: {
    total?: number;
    changed?: number;
    added?: number;
    removed?: number;
    unchanged?: number;
  };
  results?: RawTestResult[];
}

function normalizeReport(rawInput: unknown): TestRunReport {
  if (!rawInput || typeof rawInput !== 'object') {
    return {
      runId: '',
      timestamp: '',
      branch: 'main',
      commit: '',
      summary: {
        total: 0,
        changed: 0,
        added: 0,
        removed: 0,
        unchanged: 0,
      },
      results: [],
    };
  }

  const raw = rawInput as RawTestRunReport;
  const git = raw.git || {};
  const branch = git.branch || raw.branch || 'main';
  const commit = git.commit || raw.commit || '';
  const baselineCommit = git.baselineCommit || raw.baselineCommit;
  const baselineBranch = git.baselineBranch || raw.baselineBranch;
  const repositoryUrl = git.repositoryUrl || raw.repositoryUrl;
  const summary = {
    total: raw.summary?.total ?? 0,
    changed: raw.summary?.changed ?? 0,
    added: raw.summary?.added ?? 0,
    removed: raw.summary?.removed ?? 0,
    unchanged: raw.summary?.unchanged ?? 0,
  };

  const results = (raw.results || []).map((r) => {
    const candidateUrl =
      r.candidateUrl ||
      r.candidate?.url ||
      r.candidate?.path ||
      r.candidatePath;
    const baselineUrl =
      r.baselineUrl || r.baseline?.url || r.baseline?.path || r.baselinePath;
    const diffUrl =
      r.diffUrl || r.diffImage?.url || r.diffImage?.path || r.diffPath;
    const diff = r.diff || r.diffResult;

    return {
      id: r.id || 'target',
      name: r.name || 'Default',
      component: r.group || r.component || 'Component',
      status: r.status || 'unchanged',
      diffPercentage: diff?.diffPercentage ?? r.diffPercentage ?? 0,
      diffCount: diff?.diffCount ?? r.diffCount ?? 0,
      viewport: {
        name: r.viewport?.name || 'default',
        width: r.viewport?.width ?? 1280,
        height: r.viewport?.height ?? 800,
      },
      baselineUrl,
      candidateUrl,
      diffUrl,
      boundingBoxes: diff?.boundingBoxes ?? r.boundingBoxes ?? [],
    };
  });

  return {
    runId: raw.runId || '',
    timestamp: raw.timestamp || '',
    branch,
    commit,
    baselineCommit,
    baselineBranch,
    repositoryUrl,
    baselineReportUrl: raw.links?.baselineReport || raw.baselineReportUrl,
    branchLatestUrl: raw.links?.branchLatest || raw.branchLatestUrl,
    summary,
    results,
  };
}

export function useReportLoader(
  initialData?: TestRunReport,
): ReportLoaderState {
  const [data, setData] = useState<TestRunReport | null>(
    initialData ? normalizeReport(initialData) : null,
  );
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
    void reloadTrigger;
    if (initialData) {
      setData(normalizeReport(initialData));
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
              throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            const json: unknown = await response.json();
            if (!isMounted) return;
            setData(normalizeReport(json));
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
            const json: unknown = JSON.parse(scriptEl.textContent);
            if (!isMounted) return;
            setData(normalizeReport(json));
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
      if (typeof window !== 'undefined' && window.__DIFFRA_DATA__) {
        if (!isMounted) return;
        setData(normalizeReport(window.__DIFFRA_DATA__));
        setStatus('ready');
        return;
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
