import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUNDLE_INDEX_FILE } from '@diffra/core';

/** Name of the workflow artifact that holds the review bundle. */
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
 * reportBaseUrl is configured, then the uploaded artifact, then the workflow
 * run that lists artifacts, and finally the local file (which only means
 * something on the runner).
 */
export function chooseReviewLink(options: {
  hosted?: string;
  artifact?: string;
  workflowRun?: string;
  reviewDir: string;
}): string {
  const { hosted, artifact, workflowRun, reviewDir } = options;
  return (
    hosted ??
    artifact ??
    workflowRun ??
    pathToFileURL(path.join(reviewDir, BUNDLE_INDEX_FILE)).href
  );
}
