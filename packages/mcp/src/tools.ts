import {
  type ApprovalPolicy,
  type BoundingBox,
  checkApproval,
  cropPng,
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_CROP_PADDING,
  type Explanation,
  type FixSuggestions,
  type Intent,
  type NewIntent,
  type SnapshotStatus,
  type TestRunReport,
  type VerifyResult,
  type VisualTestResult,
} from '@diffra/core';
import {
  optionalInteger,
  optionalString,
  optionalStringList,
  requireString,
  requireStringList,
} from './args.js';
import type {
  ResourceDefinition,
  ToolContent,
  ToolDefinition,
  ToolResult,
} from './protocol.js';
import type { ReviewSource } from './source.js';

/** An image larger than this is refused, so one call cannot flood the agent. */
export const MAX_IMAGE_BYTES = 1_048_576;

export const LATEST_RUN_URI = 'diffra://run/latest';

/** The order an agent should look at snapshots in: what needs a decision first. */
const STATUS_ORDER: SnapshotStatus[] = [
  'changed',
  'added',
  'removed',
  'failed',
  'unchanged',
];

const IMAGE_SIDES = ['diff', 'baseline', 'candidate', 'compare'] as const;
type ImageSide = (typeof IMAGE_SIDES)[number];

/** What an agent may do beyond reading. Absent when the source is read-only. */
export interface Actions {
  run(options: { filter?: string }): Promise<TestRunReport>;
  approve(options: {
    ids: string[];
    rationale: string;
    /** The report the policy was checked against, so no other run is promoted. */
    report: TestRunReport;
  }): Promise<{ count: number; failed: number }>;
  declareIntent(input: NewIntent): Promise<Intent>;
  verify(options: {
    filter?: string;
    affected?: boolean;
  }): Promise<VerifyResult>;
  suggestFixes(explanation: Explanation): Promise<FixSuggestions>;
  prove(options: {
    id: string;
    browser?: string;
    width?: number;
    height?: number;
  }): Promise<{ id: string; explanation: Explanation }>;
}

export interface ToolDependencies {
  source: ReviewSource;
  actions?: Actions;
  /** What an agent may approve without a person. Defaults to intended changes only. */
  approvalPolicy?: ApprovalPolicy;
}

const READ_ONLY_MESSAGE =
  'This server is connected to a published review bundle, which is read-only. Start it without --report to run tests and approve baselines.';

function text(value: string): ToolContent {
  return { type: 'text', text: value };
}

function json(value: unknown): ToolResult {
  return { content: [text(JSON.stringify(value, null, 2))] };
}

function failed(message: string): ToolResult {
  return { content: [text(message)], isError: true };
}

/** What a snapshot's state means, in words, for the ones that have no pair of images. */
function explain(result: VisualTestResult): string {
  switch (result.status) {
    case 'added':
      return 'This snapshot is new: it has no baseline to compare with.';
    case 'removed':
      return 'This snapshot was removed: it has a baseline but was not captured in this run.';
    case 'failed':
      return `This snapshot could not be captured: ${result.error ?? 'no reason was recorded'}.`;
    case 'unchanged':
      return 'This snapshot matches its baseline.';
    default:
      return 'This snapshot differs from its baseline.';
  }
}

export function describeChanges(
  report: TestRunReport,
  statuses?: string[],
): Record<string, unknown>[] {
  const wanted = new Set(
    statuses ?? STATUS_ORDER.filter((s) => s !== 'unchanged'),
  );
  return report.results
    .filter((result) => wanted.has(result.status))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.id.localeCompare(b.id),
    )
    .map((result) => ({
      id: result.id,
      name: result.name,
      group: result.group,
      status: result.status,
      browser: result.browser,
      viewport: {
        width: result.viewport.width,
        height: result.viewport.height,
      },
      filePath: result.filePath,
      regions: result.diff?.boundingBoxes.length ?? 0,
      ...(result.explanation ? { why: result.explanation.summary } : {}),
      ...(result.classification
        ? { classification: result.classification }
        : {}),
      note: explain(result),
    }));
}

function selectResult(
  report: TestRunReport,
  args: Record<string, unknown>,
): VisualTestResult {
  const id = requireString(args, 'id');
  const browser = optionalString(args, 'browser');
  const width = optionalInteger(args, 'width');
  const height = optionalInteger(args, 'height');
  const matches = report.results.filter(
    (r) =>
      r.id === id &&
      (browser === undefined || r.browser === browser) &&
      (width === undefined || r.viewport.width === width) &&
      (height === undefined || r.viewport.height === height),
  );
  const [first] = matches;
  if (!first) {
    throw new Error(
      `No snapshot "${id}" in run ${report.runId}. Call diffra_list_changes to see the ids.`,
    );
  }
  if (matches.length > 1) {
    const variants = matches
      .map((r) => `${r.browser} ${r.viewport.width}x${r.viewport.height}`)
      .join(', ');
    throw new Error(
      `"${id}" was captured more than once (${variants}). Pass browser, width and height to pick one.`,
    );
  }
  return first;
}

function artifactFor(
  result: VisualTestResult,
  side: Exclude<ImageSide, 'compare'>,
) {
  if (side === 'baseline') return result.baseline;
  if (side === 'candidate') return result.candidate;
  return result.diffImage;
}

function describeBox(index: number, box: BoundingBox): string {
  return `region ${index}: x ${box.minX}-${box.maxX}, y ${box.minY}-${box.maxY}`;
}

/** Why a changed snapshot has no explanation, in words an agent can act on. */
const NO_EXPLANATION =
  'No page context was recorded for both sides of this change. Context is recorded for browser captures when agent.context is not turned off, and a baseline only has it once it was approved from a run that recorded it. Use diffra_view to compare the images.';

async function explainSnapshot(
  deps: ToolDependencies,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const report = await deps.source.readReport();
  const result = selectResult(report, args);
  const { explanation } = result;
  if (!explanation) {
    return json({
      id: result.id,
      status: result.status,
      note: result.status === 'changed' ? NO_EXPLANATION : explain(result),
    });
  }
  return json({
    id: result.id,
    status: result.status,
    filePath: result.filePath,
    summary: explanation.summary,
    proof: explanation.proof,
    causes: explanation.causes,
    regions: explanation.regions,
    note: 'Causes are attributed unless proof says otherwise: a change in the page lines up with the changed pixels. A region with no causes is not accounted for by the page. Region indexes match the region argument of diffra_view.',
  });
}

async function view(
  deps: ToolDependencies,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const report = await deps.source.readReport();
  const result = selectResult(report, args);
  const region = optionalInteger(args, 'region');
  const padding = optionalInteger(args, 'padding') ?? DEFAULT_CROP_PADDING;
  const requested =
    optionalString(args, 'side') ?? (region === undefined ? 'diff' : 'compare');
  if (!IMAGE_SIDES.includes(requested as ImageSide)) {
    throw new Error(`"side" must be one of ${IMAGE_SIDES.join(', ')}.`);
  }
  const sides: Exclude<ImageSide, 'compare'>[] =
    requested === 'compare'
      ? ['baseline', 'candidate']
      : [requested as Exclude<ImageSide, 'compare'>];

  let box: BoundingBox | undefined;
  if (region !== undefined) {
    const boxes = result.diff?.boundingBoxes ?? [];
    box = boxes[region];
    if (!box) {
      throw new Error(
        `Snapshot "${result.id}" has ${boxes.length} changed region(s), so region ${region} does not exist.`,
      );
    }
  }

  const content: ToolContent[] = [];
  for (const side of sides) {
    const url = artifactFor(result, side)?.url;
    if (!url) {
      content.push(text(`No ${side} image. ${explain(result)}`));
      continue;
    }
    let bytes = await deps.source.readImage(url);
    if (box) bytes = cropPng(bytes, box, padding);
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(
        `The ${side} image is ${bytes.length} bytes, over the ${MAX_IMAGE_BYTES} byte limit. Pass "region" to see one changed area.`,
      );
    }
    const label = box
      ? `${side}, ${describeBox(region ?? 0, box)} (padding ${padding})`
      : `${side}, whole snapshot`;
    content.push(text(label));
    content.push({
      type: 'image',
      data: bytes.toString('base64'),
      mimeType: 'image/png',
    });
  }
  return { content };
}

export function createTools(deps: ToolDependencies): ToolDefinition[] {
  const snapshotSelector = {
    id: {
      type: 'string',
      description: 'Snapshot id from diffra_list_changes.',
    },
    browser: {
      type: 'string',
      description:
        'Only needed when the snapshot was captured in several browsers.',
    },
    width: {
      type: 'integer',
      minimum: 0,
      description: 'Viewport width, when it was captured at several sizes.',
    },
    height: {
      type: 'integer',
      minimum: 0,
      description: 'Viewport height, when it was captured at several sizes.',
    },
  };

  const tools: ToolDefinition[] = [
    {
      name: 'diffra_status',
      description:
        'Summarises the latest test run: its branch and commit, how many snapshots changed, were added, removed or failed, and whether this server can run tests and approve baselines.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      handler: async () => {
        const report = await deps.source.readReport();
        return json({
          runId: report.runId,
          timestamp: report.timestamp,
          schemaVersion: report.schemaVersion,
          git: report.git,
          summary: report.summary,
          partial: { shard: report.shard, filter: report.filter },
          gate: report.gate,
          intents: report.intents?.map(({ id, description, author }) => ({
            id,
            description,
            author,
          })),
          review: report.links?.review,
          canRunAndApprove: deps.source.writable && deps.actions !== undefined,
        });
      },
    },
    {
      name: 'diffra_list_changes',
      description:
        'Lists the snapshots of the latest run that need a decision, most important first: changed, added, removed, then failed. Each entry says in words what its state means.',
      inputSchema: {
        type: 'object',
        properties: {
          statuses: {
            type: 'array',
            items: { type: 'string', enum: STATUS_ORDER },
            description:
              'Which statuses to list. Defaults to everything except unchanged.',
          },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const report = await deps.source.readReport();
        return json(
          describeChanges(report, optionalStringList(args, 'statuses')),
        );
      },
    },
    {
      name: 'diffra_explain',
      description:
        'Explains a changed snapshot from what was on the page: which element changed, which styles, which stylesheet rule set them, whether that file changed in this branch, and which changed regions each cause accounts for. Start here for a changed snapshot, then use diffra_view to look at a region.',
      inputSchema: {
        type: 'object',
        properties: snapshotSelector,
        required: ['id'],
        additionalProperties: false,
      },
      handler: (args) => explainSnapshot(deps, args),
    },
    {
      name: 'diffra_prove',
      description:
        'Tests the cause of a changed snapshot in the live page: loads the page again, undoes the changes that diffra_explain found, and compares with the baseline. If the pixels match again, the cause is proven rather than only attributed. The page the snapshot came from has to be reachable, such as a running Storybook or development server. Not available on a read-only server.',
      inputSchema: {
        type: 'object',
        properties: snapshotSelector,
        required: ['id'],
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!actions) return failed(READ_ONLY_MESSAGE);
        const { id, explanation } = await actions.prove({
          id: requireString(args, 'id'),
          browser: optionalString(args, 'browser'),
          width: optionalInteger(args, 'width'),
          height: optionalInteger(args, 'height'),
        });
        return json({
          id,
          summary: explanation.summary,
          proof: explanation.proof,
          causes: explanation.causes.map((cause) => ({
            element: cause.element,
            confidence: cause.confidence,
          })),
        });
      },
    },
    {
      name: 'diffra_verify',
      description:
        'Runs the tests again after you changed something and says what became of the changes that were open before: resolved, still changed, newly changed, or not checked. With affected, captures only the snapshots that the changed files are known to reach, which is much faster; the result lists changed files that are not known to affect any snapshot, and if any of them is component code, run without affected. Not available on a read-only server.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description:
              'Case-insensitive text a target id, name or group must contain.',
          },
          affected: {
            type: 'boolean',
            description:
              'Capture only the snapshots that the files changed since the baseline commit are known to reach.',
          },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!actions) return failed(READ_ONLY_MESSAGE);
        if (args.affected !== undefined && typeof args.affected !== 'boolean') {
          throw new Error('"affected" must be true or false.');
        }
        const { report, verification, affected } = await actions.verify({
          filter: optionalString(args, 'filter'),
          affected: args.affected === true,
        });
        return json({
          runId: report.runId,
          summary: report.summary,
          verification,
          ...(affected ? { affected } : {}),
          changes: describeChanges(report),
        });
      },
    },
    {
      name: 'diffra_suggest_fix',
      description:
        'Says how to undo a change whose cause is proven: which styles to put back, in which stylesheet and rule, and, when the earlier values can be written back exactly, a unified diff to apply with git apply. Nothing is suggested until diffra_prove has proven the cause. Apply a patch only if the change was not intended. Not available on a read-only server.',
      inputSchema: {
        type: 'object',
        properties: snapshotSelector,
        required: ['id'],
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!actions) return failed(READ_ONLY_MESSAGE);
        const report = await deps.source.readReport();
        const result = selectResult(report, args);
        if (!result.explanation) {
          return json({
            id: result.id,
            suggestions: [],
            note:
              result.status === 'changed' ? NO_EXPLANATION : explain(result),
          });
        }
        return json({
          id: result.id,
          ...(await actions.suggestFixes(result.explanation)),
        });
      },
    },
    {
      name: 'diffra_view',
      description:
        'Returns images of one snapshot. By default the diff of the whole snapshot. Pass region (an index from the regions of a changed snapshot) to get the baseline and candidate cropped to that one changed area, which is far cheaper than whole screenshots.',
      inputSchema: {
        type: 'object',
        properties: {
          ...snapshotSelector,
          region: {
            type: 'integer',
            minimum: 0,
            description: 'Index of a changed region. Crops the images to it.',
          },
          side: {
            type: 'string',
            enum: [...IMAGE_SIDES],
            description:
              'Which image. "compare" returns baseline then candidate. Defaults to diff, or compare when region is given.',
          },
          padding: {
            type: 'integer',
            minimum: 0,
            description: `Pixels of context around a region. Default ${DEFAULT_CROP_PADDING}.`,
          },
        },
        required: ['id'],
        additionalProperties: false,
      },
      handler: (args) => view(deps, args),
    },
  ];

  const { actions } = deps;
  tools.push(
    {
      name: 'diffra_run',
      description:
        'Runs the visual tests now and returns the snapshots that need a decision. Pass filter to capture only targets whose id, name or group contains that text, which is much faster while working on one component.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description:
              'Case-insensitive text a target id, name or group must contain.',
          },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!actions) return failed(READ_ONLY_MESSAGE);
        const report = await actions.run({
          filter: optionalString(args, 'filter'),
        });
        return json({
          runId: report.runId,
          summary: report.summary,
          changes: describeChanges(report),
        });
      },
    },
    {
      name: 'diffra_declare_intent',
      description:
        'Declares what you are about to change, before you change it. Later runs then judge each change against it: a change that comes from what you declared is intended, and any other is collateral. Name what the change may touch with at least one of targets, sources or selectors.',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'What should change, in a sentence.',
          },
          targets: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Snapshots expected to change: an id, or text in a name or group.',
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Stylesheets the change is expected to come from, such as src/button.css.',
          },
          selectors: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Rule selectors the change is expected to come from, such as .btn.',
          },
        },
        required: ['description'],
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!actions) return failed(READ_ONLY_MESSAGE);
        const intent = await actions.declareIntent({
          description: requireString(args, 'description'),
          targets: optionalStringList(args, 'targets'),
          sources: optionalStringList(args, 'sources'),
          selectors: optionalStringList(args, 'selectors'),
          author: 'agent',
        });
        return json({
          intent,
          note: 'Run diffra_run to judge the changes against it. It stays declared until it is cleared.',
        });
      },
    },
    {
      name: 'diffra_approve',
      description:
        'Accepts the listed snapshots as the new baseline for the current commit, and records who approved them and why. What you may approve depends on the project policy (agent.autoApprove): by default only changes that a declared intent covers. A refused snapshot says what is missing. There is no way to approve a whole run at once; list each id, and say in the rationale why the change is intended.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Snapshot ids to approve.',
          },
          rationale: {
            type: 'string',
            description:
              'Why these changes are intended, in a sentence. Kept in the approval record.',
          },
        },
        required: ['ids', 'rationale'],
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!actions) return failed(READ_ONLY_MESSAGE);
        const ids = requireStringList(args, 'ids');
        const rationale = requireString(args, 'rationale');
        const policy = deps.approvalPolicy ?? DEFAULT_APPROVAL_POLICY;
        const report = await deps.source.readReport();
        const refused = report.results
          .filter((r) => ids.includes(r.id))
          .map((r) => ({ result: r, check: checkApproval(r, policy) }))
          .filter((entry) => !entry.check.allowed);
        if (refused.length > 0) {
          return failed(
            `Not approved, by the approval policy "${policy}":\n${refused
              .map(
                ({ result, check }) =>
                  `- "${result.id}": ${check.reason ?? 'not allowed.'}`,
              )
              .join(
                '\n',
              )}\nLook at a change with diffra_explain. If it is intended, declare an intent that covers it with diffra_declare_intent and run again. Otherwise a person approves it with diffra approve.`,
          );
        }
        const outcome = await actions.approve({ ids, rationale, report });
        if (outcome.failed > 0) {
          return failed(
            `${outcome.failed} snapshot(s) could not be promoted, and ${outcome.count} were. Run diffra approve to see why.`,
          );
        }
        return json({ approved: outcome.count, failed: outcome.failed, ids });
      },
    },
  );
  return tools;
}

export function createResources(deps: ToolDependencies): ResourceDefinition[] {
  return [
    {
      uri: LATEST_RUN_URI,
      name: 'Latest run report',
      description: 'The complete report.json of the latest run.',
      mimeType: 'application/json',
      read: async () => JSON.stringify(await deps.source.readReport(), null, 2),
    },
  ];
}
