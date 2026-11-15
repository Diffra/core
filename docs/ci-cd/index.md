# CI/CD

Diffra is built to run on every pull request. These pages cover the pipeline.

| Page | Use it for |
| :--- | :--- |
| [GitHub Actions workflow](github-actions.md) | The official action: status checks, pull request comments, annotations and baseline promotion on merge. |
| [Parallel CI sharding and report merger](parallel-sharding.md) | Splitting a run across matrix jobs and merging the reports. |
| [Self-hosted report deployment](hosting-reports.md) | Publishing the review bundle to GitHub Pages, Cloudflare Pages, S3 or Vercel. |
| [Other CI providers](other-ci-providers.md) | GitLab CI, CircleCI and Bitbucket Pipelines, using the CLI. Any CI that can run Node works the same way. |

Reference: [GitHub Action inputs and outputs](../reference/action-reference.md), [CLI](../reference/cli.md).
