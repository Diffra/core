# Compatibility

What Diffra works with.

| Area | Supported |
| :--- | :--- |
| Agents | Any client that speaks the Model Context Protocol, plus a skill file for clients that read one. See [AI agents](../agents/overview.md). |
| Targets | [Storybook](../getting-started/storybook-quickstart.md), [web apps and routes](../getting-started/web-apps-quickstart.md), [Playwright tests](../getting-started/playwright-quickstart.md), [Figma](../guides/figma-design-qa.md), [image sets](../guides/static-images-and-canvas.md), and [custom drivers](../storage-and-plugins/custom-plugins-and-drivers.md). |
| Browsers | Chromium, Firefox and WebKit. Page context for explanations is recorded for browser captures. |
| Storage | Local disk, Amazon S3 and compatible stores such as Cloudflare R2 and MinIO, Google Cloud Storage, Azure Blob. See [storage adapters](../storage-and-plugins/storage-adapters.md). |
| CI | [GitHub Actions](../ci-cd/github-actions.md). [GitLab CI, CircleCI and Bitbucket Pipelines](../ci-cd/other-ci-providers.md) through the CLI. Any CI that runs Node works the same way. |
| Notifications | GitHub checks and comments, Slack, or a [custom notifier](../storage-and-plugins/notifiers.md). |
| Runtime | Node 26 or later. The comparison engine ships binaries for Linux (x64, arm64), macOS (x64, arm64) and Windows (x64). See [core engine](../architecture/core-engine.md). |
