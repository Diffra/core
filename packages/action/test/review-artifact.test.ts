import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uploadArtifact = vi.fn();

vi.mock('@actions/artifact', () => ({
  DefaultArtifactClient: class {
    uploadArtifact = uploadArtifact;
  },
}));

import { artifactUrl, uploadReviewBundle } from '../src/review-artifact.js';

const RUNNER_ENV = {
  ACTIONS_RUNTIME_TOKEN: 'token',
  GITHUB_SERVER_URL: 'https://github.example.test',
  GITHUB_REPOSITORY: 'acme/widgets',
  GITHUB_RUN_ID: '42',
};

describe('review bundle upload', () => {
  let dir: string;

  beforeEach(async () => {
    uploadArtifact.mockReset();
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-artifact-'));
    await fs.mkdir(path.join(dir, 'images'), { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), '<html></html>');
    await fs.writeFile(path.join(dir, 'images', 'a.png'), 'png');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('uploads every file under the bundle root and links the artifact', async () => {
    uploadArtifact.mockResolvedValue({ id: 7, size: 20 });

    const url = await uploadReviewBundle(dir, vi.fn(), RUNNER_ENV);

    expect(url).toBe(
      'https://github.example.test/acme/widgets/actions/runs/42/artifacts/7',
    );
    const [name, files, root] = uploadArtifact.mock.calls[0] ?? [];
    expect(name).toBe('diffra-report');
    expect(root).toBe(dir);
    expect([...files].sort()).toEqual([
      path.join(dir, 'images', 'a.png'),
      path.join(dir, 'index.html'),
    ]);
  });

  it('does nothing outside a workflow, where there is no runtime token', async () => {
    expect(await uploadReviewBundle(dir, vi.fn(), {})).toBeUndefined();
    expect(uploadArtifact).not.toHaveBeenCalled();
  });

  it('does not fail the run when the upload fails, and says why', async () => {
    uploadArtifact.mockRejectedValue(new Error('quota exceeded'));
    const warn = vi.fn();

    expect(await uploadReviewBundle(dir, warn, RUNNER_ENV)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('quota exceeded'),
    );
  });

  it('returns no link when the service gives no artifact id', async () => {
    uploadArtifact.mockResolvedValue({});
    expect(await uploadReviewBundle(dir, vi.fn(), RUNNER_ENV)).toBeUndefined();
  });

  it('builds the artifact address only when the run is known', () => {
    expect(artifactUrl(3, RUNNER_ENV)).toBe(
      'https://github.example.test/acme/widgets/actions/runs/42/artifacts/3',
    );
    expect(artifactUrl(3, {})).toBeUndefined();
  });
});
