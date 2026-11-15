# MCP server reference

`diffra mcp` and the `diffra-mcp` binary of `@diffra/mcp` serve the [Model Context Protocol](https://modelcontextprotocol.io) over standard input and output, one JSON message per line. The server has no runtime dependencies. Standard output carries only protocol messages; ordinary logging goes to standard error.

## Options

| Flag | Description |
| :--- | :--- |
| `-c, --config <path>` | Path to the Diffra configuration file. |
| `-r, --report <where>` | A published review bundle, as an address or a folder. Makes the server read-only. |

## Tools

### diffra_status

Summarises the latest run: its identifier, branch and commit, the counts of each status, whether the run covered only a shard or a filter, the review link, and whether this server can run tests and approve baselines.

### diffra_list_changes

Lists the snapshots that need a decision, most important first: changed, added, removed, then failed.

| Argument | Type | Description |
| :--- | :--- | :--- |
| `statuses` | `string[]` | Statuses to list. Defaults to everything except unchanged. |

Each entry has `id`, `name`, `group`, `status`, `browser`, `viewport`, `filePath` when the driver knows the source file, `regions` (the number of changed areas), `why` when the change is explained, `classification` when intents were declared, and a `note` that explains the state in words.

### diffra_explain

Explains a changed snapshot from what was on the page. Takes the same snapshot arguments as `diffra_view` (`id`, and `browser`, `width` and `height` when needed).

The result has a one-sentence `summary`, the `causes`, and the `regions` of the diff with the indexes of the causes that account for each. Region indexes match the `region` argument of `diffra_view`. For a snapshot with no explanation, the result says why. See [Explained changes](explained-changes.md).

### diffra_declare_intent

Declares what is about to change, before it is changed. Not available on a read-only server. See [Intent contracts](intent-contracts.md).

| Argument | Type | Description |
| :--- | :--- | :--- |
| `description` | `string` | Required. What should change, in a sentence. |
| `targets` | `string[]` | Snapshots expected to change: an id, or text in a name or group. |
| `sources` | `string[]` | Stylesheets the change is expected to come from. |
| `selectors` | `string[]` | Rule selectors the change is expected to come from. |

At least one of `targets`, `sources` and `selectors` is required.

### diffra_prove

Tests the cause of a changed snapshot by undoing it in the live page and comparing with the baseline. Takes the same snapshot arguments as `diffra_explain`. Not available on a read-only server. The page has to be reachable. See [Proof](proof.md).

### diffra_suggest_fix

Says how to undo a change whose cause is proven: the styles to put back, where they are set, and a unified diff when the earlier values can be written back exactly. Takes the same snapshot arguments as `diffra_explain`. Nothing is suggested until the cause is proven. Not available on a read-only server. See [Fixes and verification](fixes-and-verification.md).

### diffra_verify

Runs the tests again and says what became of the changes that were open before: resolved, still changed, newly changed, or not checked. Not available on a read-only server.

| Argument | Type | Description |
| :--- | :--- | :--- |
| `filter` | `string` | Case-insensitive text that a target id, name or group must contain. |
| `affected` | `boolean` | Capture only the snapshots that the changed files are known to reach. The result lists changed files that are not known to affect any snapshot. |

### diffra_view

Returns images of one snapshot.

| Argument | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Required. Snapshot id. |
| `browser`, `width`, `height` | | Needed only when the snapshot was captured more than once. |
| `region` | `integer` | Index of a changed region. Crops the images to it. |
| `side` | `string` | `diff`, `baseline`, `candidate` or `compare` (baseline then candidate). Defaults to `diff`, or `compare` when `region` is given. |
| `padding` | `integer` | Pixels of context around a region. Default 16. |

An image over 1 MiB is refused with a hint to pass `region`.

### diffra_run

Runs the tests and returns the snapshots that need a decision. Not available on a read-only server.

| Argument | Type | Description |
| :--- | :--- | :--- |
| `filter` | `string` | Case-insensitive text that a target id, name or group must contain. |

### diffra_approve

Accepts snapshots as the new baseline for the current commit. Not available on a read-only server.

| Argument | Type | Description |
| :--- | :--- | :--- |
| `ids` | `string[]` | Required, not empty. Snapshot ids to approve. An id that is not in the run is an error. |
| `rationale` | `string` | Required. Why the changes are intended, in a sentence. It is kept in the approval record. |

## Resources

| URI | Description |
| :--- | :--- |
| `diffra://run/latest` | The complete `report.json` of the latest run. |

## Errors

A tool that cannot do what it was asked returns a result with `isError` set and a message the agent can act on, such as the ids that exist or the number of regions a snapshot has. Protocol faults, such as an unknown tool, use JSON-RPC errors.
