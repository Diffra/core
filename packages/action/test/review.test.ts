import { describe, expect, it } from 'vitest';
import { chooseReviewLink, workflowRunUrl } from '../src/review.js';

describe('review link', () => {
  const reviewDir = '/work/.diffra/runs/run-1';

  it('prefers the hosted copy, then the artifact, then the workflow run', () => {
    const all = {
      hosted: 'https://reports.example.test/runs/run-1/',
      artifact: 'https://github.example.test/o/r/actions/runs/9/artifacts/4',
      workflowRun: 'https://github.example.test/o/r/actions/runs/9',
      reviewDir,
    };
    expect(chooseReviewLink(all)).toBe(all.hosted);
    expect(chooseReviewLink({ ...all, hosted: undefined })).toBe(all.artifact);
    expect(
      chooseReviewLink({ ...all, hosted: undefined, artifact: undefined }),
    ).toBe(all.workflowRun);
  });

  it('falls back to the local page when nothing is published', () => {
    expect(chooseReviewLink({ reviewDir })).toBe(
      'file:///work/.diffra/runs/run-1/index.html',
    );
  });

  it('builds the workflow run address from the runner environment', () => {
    expect(
      workflowRunUrl({
        GITHUB_SERVER_URL: 'https://github.example.test/',
        GITHUB_REPOSITORY: 'acme/widgets',
        GITHUB_RUN_ID: '42',
      }),
    ).toBe('https://github.example.test/acme/widgets/actions/runs/42');
    expect(workflowRunUrl({})).toBeUndefined();
  });
});
