# Diffra documentation

Diffra finds visual regressions in your pull requests, and gives your coding agent what it needs to explain, fix and verify them. It is self-hosted and runs in your CI. This is the map of the documentation.

New here? Start with the [agent quickstart](getting-started/agent-quickstart.md) to see the loop, or [How Diffra works](concepts/how-diffra-works.md) for the model.

## Find a page by goal

| I want to | Read |
| :--- | :--- |
| Have an agent fix visual regressions | [Agent quickstart](getting-started/agent-quickstart.md) |
| See what an agent does, step by step | [Agent workflows](agents/workflows.md) |
| Decide what an agent may approve | [Approvals](agents/approvals.md) |
| Set up Diffra for Storybook | [Storybook quickstart](getting-started/storybook-quickstart.md) |
| Set up Diffra for a web app | [Web applications quickstart](getting-started/web-apps-quickstart.md) |
| Add visual assertions to Playwright tests | [Playwright quickstart](getting-started/playwright-quickstart.md) |
| Run it on every pull request | [GitHub Actions workflow](ci-cd/github-actions.md) |
| Use GitLab, CircleCI or Bitbucket | [Other CI providers](ci-cd/other-ci-providers.md) |
| Speed up a large run | [Parallel sharding](ci-cd/parallel-sharding.md) |
| Stop false positives | [Flakiness and determinism](guides/flakiness-and-determinism.md) |
| Compare code to Figma | [Figma design parity](guides/figma-design-qa.md) |
| Store baselines in my own bucket | [Storage adapters](storage-and-plugins/storage-adapters.md) |
| Publish review reports | [Hosting reports](ci-cd/hosting-reports.md) |
| Find a config option or flag | [Configuration](reference/configuration.md), [CLI](reference/cli.md) |
| Fix an error | [Troubleshooting](troubleshooting.md) |

## Sections

| Section | What is in it |
| :--- | :--- |
| [Getting started](getting-started/index.md) | Setup in a few minutes: an agent quickstart and one per kind of project. |
| [AI agents](agents/index.md) | Detect, explain, prove, fix, verify, approve: explained changes, intent, proof, fixes, approvals, the MCP server. |
| [Concepts](concepts/index.md) | The model behind a run, and a glossary. |
| [Guides](guides/index.md) | Task-focused pages: what to test, and how to run it well. |
| [CI/CD](ci-cd/index.md) | The GitHub Action, sharding, hosting reports, other providers. |
| [Review interface](review-ui/index.md) | The review UI, its comparison modes and shortcuts. |
| [Storage and plugins](storage-and-plugins/index.md) | Storage adapters, notifiers, custom drivers and plugins. |
| [Reference](reference/index.md) | Configuration, CLI, parameters, action inputs, types. |
| [Architecture](architecture/index.md) | The pipeline, the engine, the review bundle. |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes and fixes. |

## Project

[Contributing](../CONTRIBUTING.md) · [Security](../SECURITY.md) · [Code of conduct](../CODE_OF_CONDUCT.md) · [Repository README](../README.md)
