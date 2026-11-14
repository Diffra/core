import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUNDLE_INDEX_FILE } from '@diffra/core';

/** Name the documented upload step gives the review bundle artifact. */
export const REVIEW_ARTIFACT_NAME = 'diffra-report';

/** The page of the current workflow run, where its artifacts are listed. */
export function workflowRunUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const server = env.GITHUB_SERVER_URL;
  const repository = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  if (!server || !repository || !runId) return undefined;
  return `${server.replace(/\/+$/, '')}/${repository}/actions/runs/${runId}`;
}

/**
 * Picks the address reviewers are sent to: the published copy when
 * reportBaseUrl is configured, then the workflow run that holds the uploaded
 * bundle, and finally the local file (which only means something on the runner).
 */
export function chooseReviewLink(options: {
  hosted?: string;
  workflowRun?: string;
  reviewDir: string;
}): string {
  const { hosted, workflowRun, reviewDir } = options;
  return (
    hosted ??
    workflowRun ??
    pathToFileURL(path.join(reviewDir, BUNDLE_INDEX_FILE)).href
  );
}
