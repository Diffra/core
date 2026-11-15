# AI agents

Diffra gives coding agents the review loop a person has, plus evidence a person would have to dig for. It never calls a model.

Start with the [agent quickstart](../getting-started/agent-quickstart.md) to set it up in one command, then the [overview](overview.md).

| Page | Covers |
| :--- | :--- |
| [Overview](overview.md) | The loop, in CI and on a developer machine, and the safety rules. |
| [Workflows](workflows.md) | Fixing a regression, landing a redesign, triaging a failing pull request, checking blast radius. |
| [Explained changes](explained-changes.md) | The render ledger, causes, and how sure an explanation is. |
| [Intent contracts](intent-contracts.md) | Declaring what a change should alter, and gating on what nobody intended. |
| [Proof](proof.md) | Testing a cause by undoing it in the live page. |
| [Fixes and verification](fixes-and-verification.md) | Patches that undo a proven change, and checking what is resolved. |
| [Approvals](approvals.md) | What an agent may approve, and the record kept. |
| [MCP server reference](mcp-reference.md) | Tools, arguments, resources and errors. |

## What an agent gets

| Capability | What it means |
| :--- | :--- |
| Sees cheaply | A text summary of every change, and one cropped region instead of whole screenshots. |
| Understands | The element, style and rule behind each change, with how sure the explanation is. |
| Knows what you meant | Declared intent separates the change you asked for from collateral damage. |
| Is sure | Counterfactual proof in the live page, not a correlation. |
| Fixes | A patch that undoes a proven change, ready to apply. |
| Checks its work | Verification of exactly what the edit resolved or broke. |
| Stays in bounds | Approval by snapshot id, under your policy, written to an audit log. |
