# @diffra/mcp

A zero-dependency Model Context Protocol server that lets AI agents review, look closely at, and approve Diffra visual changes.

```bash
npx diffra mcp                      # this project: run tests, review, approve
npx diffra mcp --report <address>   # a published review bundle, read-only
```

The server provides ten tools (`diffra_status`, `diffra_list_changes`, `diffra_explain`, `diffra_prove`, `diffra_suggest_fix`, `diffra_verify`, `diffra_declare_intent`, `diffra_view`, `diffra_run`, `diffra_approve`) and one resource (`diffra://run/latest`). See the [agent guide](../../docs/agents/overview.md) and the [reference](../../docs/agents/mcp-reference.md).

[`skill/SKILL.md`](skill/SKILL.md) is an agent skill that describes the review loop.
