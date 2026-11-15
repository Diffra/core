<div align="center">

# Diffra

**Your agent changes the UI. Diffra makes sure nothing else does, and fixes it when something does.**

Visual regression testing where the agent closes the loop: it finds what a pull request broke, knows why, repairs it, and proves the repair, before a human opens a screenshot. Self-hosted, and built for CI.

[![CI](https://github.com/Diffra/core/actions/workflows/ci.yml/badge.svg)](https://github.com/Diffra/core/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Agents: MCP](https://img.shields.io/badge/agents-MCP-6e56cf.svg)](docs/agents/overview.md)
[![Engine: Rust](https://img.shields.io/badge/engine-Rust-b7410e.svg)](docs/architecture/core-engine.md)
[![Node](https://img.shields.io/badge/node-%E2%89%A526-339933.svg)](package.json)
[![Self-hosted](https://img.shields.io/badge/data-your%20bucket-0a7ea4.svg)](docs/storage-and-plugins/storage-adapters.md)

[Put your agent on it](docs/getting-started/agent-quickstart.md) · [Documentation](docs/index.md) · [How it works](docs/concepts/how-diffra-works.md)

</div>

---

## Detect. Explain. Prove. Fix. Verify. Approve.

That is one uninterrupted loop, and your agent runs all of it.

Every other visual testing tool ends at a picture of what changed and a button that says accept. Diffra is built for the world where agents write most of the UI code: it hands the agent the cause, not just the pixels, so a visual regression becomes a task the agent finishes instead of a ticket a person triages.

## What it does for your team

**Reviewers stop triaging pixels.** When an agent does the work, the unintended changes are fixed and verified before a person looks. What is left is the change that was asked for, labeled as intended, with a link to look at it.

**Agents stop guessing.** A screenshot makes a model squint and speculate. Diffra tells it which element moved, which rule did it, and whether that file changed in this branch. It tests the theory in the live page before anyone acts on it.

**"Update the snapshots" stops being a reflex.** The most dangerous move in visual testing is approving a regression to make a check go green. Here, approval is by snapshot, gated by what the agent declared it would change, and logged with who approved it and why.

**Fixes that are checked, not hoped for.** A proven cause comes with a patch that puts the old values back, and a change-scoped re-run confirms what is resolved and what is not. If it still looks wrong, the agent knows before it pushes.

**Redesigns stop being scary.** Declare the intent once, and a token change that touches hundreds of snapshots shows up as what it is: the part you meant, and the collateral you did not.

## One regression, start to finish

A design token changes to make buttons roomier. The agent declares that intent, edits, and Diffra runs. The buttons changed as intended. A card did too, and nothing declared covers it. Diffra says why: the card title picked up a new margin from the same token, and undoing that margin restores the card exactly. The agent applies the patch, scopes the margin to buttons, and re-runs the check. The card is resolved and nothing else moved. The agent approves the button snapshots with a one-line rationale, and the pull request shows one intended change and no collateral damage.

Nobody opened a screenshot viewer, and nobody guessed.

## Bring any agent

Diffra speaks the Model Context Protocol and ships a skill that teaches an agent the loop. One command sets up a project, and from then on the agent can see changes cheaply, one cropped region at a time, rather than paying for whole screenshots. The same tools work on a developer's machine, where the agent can fix, and against a published CI report, where it can only read. See the [agent quickstart](docs/getting-started/agent-quickstart.md) and [agent workflows](docs/agents/workflows.md).

## You stay in charge

* **Diffra never calls a model.** It supplies evidence and applies decisions. Your agent, with the model you choose, supplies the judgment.
* **You set what an agent may approve.** From nothing at all to anything covered by a declared intent, and a person can always override.
* **It says how sure it is.** A cause is attributed until it is proven, and the report says which.
* **Your data stays yours.** Baselines and reports live on your disk or in your own bucket, with no screenshot quotas.

## Built on CI

Diffra runs in your pull request workflow with an official [GitHub Action](docs/ci-cd/github-actions.md): a check and a review link on every pull request, baselines taken from the [merge-base](docs/guides/baseline-management.md), and the approved baseline promoted when it merges. It reads Storybook, web apps, Playwright tests, Figma and images, and [shards](docs/ci-cd/parallel-sharding.md) large runs across jobs. See [compatibility](docs/reference/compatibility.md).

## Start here

* [Agent quickstart](docs/getting-started/agent-quickstart.md): the loop, set up in one command.
* [Agent workflows](docs/agents/workflows.md): fixing regressions, landing redesigns, triaging a failing pull request.
* [Getting started](docs/getting-started/index.md): set up Diffra for your project.
* [Documentation hub](docs/index.md): every page, by goal.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Packages](docs/architecture/packages.md) · [MIT license](LICENSE)
