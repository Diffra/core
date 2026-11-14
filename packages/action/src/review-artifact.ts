import fs from 'node:fs/promises';
import path from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import { REVIEW_ARTIFACT_NAME } from './review.js';

/** Where the artifact of a workflow run can be opened. */
export function artifactUrl(
  id: number,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const server = env.GITHUB_SERVER_URL;
  const repository = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  if (!server || !repository || !runId) return undefined;
  return `${server.replace(/\/+$/, '')}/${repository}/actions/runs/${runId}/artifacts/${id}`;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Uploads the review bundle as a workflow artifact and returns its address.
 * Returns undefined, without failing the run, when there is nothing to upload,
 * the process is not running inside a workflow, or the upload fails: a missing
 * artifact must not turn a passing visual run red.
 */
export async function uploadReviewBundle(
  reviewDir: string,
  warn: (message: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  // The artifact service is only reachable with the runner's runtime token.
  if (!env.ACTIONS_RUNTIME_TOKEN) return undefined;

  try {
    const files = await listFiles(reviewDir);
    if (files.length === 0) return undefined;

    const { id } = await new DefaultArtifactClient().uploadArtifact(
      REVIEW_ARTIFACT_NAME,
      files,
      reviewDir,
    );
    return id === undefined ? undefined : artifactUrl(id, env);
  } catch (error) {
    warn(
      `Could not upload the review bundle as an artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}
