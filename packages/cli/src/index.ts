import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  addIntent,
  approveBaselines,
  BUNDLE_INDEX_FILE,
  clearIntents,
  DEFAULT_INTENT_FILE,
  decisionsNeeded,
  loadConfig,
  loadRunReport,
  mergeReports,
  proveSnapshot,
  readIntents,
  runVisualRegression,
  suggestFixes,
  verifyRun,
} from '@diffra/core';
import { setupAgent, startMcpServer } from '@diffra/mcp';
import {
  createServeHandler,
  formatServerUrl,
  startServeServer,
} from './serve.js';
import { colors } from './utils/colors.js';
import { openInBrowser } from './utils/open.js';

export { createServeHandler, formatServerUrl, startServeServer };

const VERSION = '0.1.0';

export function printHelp(): void {
  console.log(`
${colors.bold(colors.cyan('Diffra Visual Regression CLI'))} v${VERSION}

${colors.bold('Usage:')}
  diffra [command] [options]

${colors.bold('Commands:')}
  test           Run visual regression suite (default)
  approve        Approve candidate screenshots as the new baseline
  status         Show the summary of the latest run
  intent         Declare what a change should alter: add, list, clear
  prove          Test the cause of a changed snapshot by undoing it in the live page
  fix            Print a patch that undoes a proven change, for git apply
  verify         Run again and say which open changes are resolved
  agent          Prepare this project for AI agents: agent init
  mcp            Serve Diffra to AI agents over the Model Context Protocol
  merge-reports  Merge multiple shard report manifests into a consolidated run
  serve          Serve the latest review bundle on a local port
  help           Show this help information

${colors.bold('Options:')}
  -d, --driver <name>         Driver adapter ('storybook', 'url', 'image', 'figma')
  -u, --url <url>             Base URL for Storybook or live preview site
      --urls <paths>          Comma-separated list of routes for URL driver
  -c, --config <file>         Custom configuration file path
  -b, --branch <branch>       Baseline Git branch override
  -t, --diff-threshold <num>  Perceptual diff threshold (default: 0.063)
      --delay <ms>            Delay before capture in ms
  -o, --output-dir <dir>      Output artifacts directory (default: .diffra)
      --concurrency <num>     Parallel screenshot workers (default: 4)
      --shard <spec>          Shard slice (e.g. 1/4, 2/4)
      --shard-dir <dir>       Directory containing shard report to merge (multiple allowed)
      --pass-on-changes       Exit with 0 even if visual differences are detected
      --update-baseline       Automatically promote changed candidate screenshots to baseline
  -f, --filter <pattern>      Filter test targets by name or group
      --open                  Open review report in browser after test run
      --ci                    Run in non-interactive CI mode
      --json                  Print JSON only on stdout (test, approve, status)
      --rationale <text>      With approve: why the changes are intended, kept in the approval record
      --affected              With verify: capture only the snapshots the changed files are known to reach
      --force                 With agent init: replace an agent configuration that differs
      --no-skill              With agent init: register the server only, without the skill
      --gate <mode>           Fail on 'any' change (default) or only 'collateral' ones that no intent covers
      --target <text>         With intent add: a snapshot id, name or group the change may touch
      --source <file>         With intent add: a stylesheet the change is expected to come from
      --selector <selector>   With intent add: a rule selector the change is expected to come from
  -p, --port <number>         Custom port for preview server
  -r, --report <path>         Report JSON path to serve, or review bundle for mcp
  -v, --version               Display version
  -h, --help                  Show this help information

${colors.bold('Examples:')}
  diffra
  diffra -d storybook -u http://127.0.0.1:6006
  diffra -d url -u http://127.0.0.1:3000 --urls /,/about,/pricing
  diffra --shard 1/4
  diffra approve
  diffra approve <snapshot-id>...
  diffra prove <snapshot-id>
  diffra fix <snapshot-id> | git apply
  diffra agent init
  diffra mcp
  diffra intent add "Roomier buttons" --source src/button.css
  diffra --gate collateral
  diffra merge-reports .diffra/shard-1 .diffra/shard-2 -o .diffra
  diffra serve --port 3000
`);
}

export const CLI_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  driver: { type: 'string', short: 'd' },
  url: { type: 'string', short: 'u' },
  urls: { type: 'string' },
  config: { type: 'string', short: 'c' },
  branch: { type: 'string', short: 'b' },
  'diff-threshold': { type: 'string', short: 't' },
  delay: { type: 'string' },
  'output-dir': { type: 'string', short: 'o' },
  concurrency: { type: 'string' },
  shard: { type: 'string' },
  'shard-dir': { type: 'string', multiple: true },
  'pass-on-changes': { type: 'boolean' },
  open: { type: 'boolean' },
  port: { type: 'string', short: 'p' },
  report: { type: 'string', short: 'r' },
  'update-baseline': { type: 'boolean' },
  filter: { type: 'string', short: 'f' },
  ci: { type: 'boolean' },
  json: { type: 'boolean' },
  gate: { type: 'string' },
  force: { type: 'boolean' },
  'no-skill': { type: 'boolean' },
  affected: { type: 'boolean' },
  rationale: { type: 'string' },
  target: { type: 'string', multiple: true },
  source: { type: 'string', multiple: true },
  selector: { type: 'string', multiple: true },
} as const;

export async function main(args = process.argv.slice(2)): Promise<number> {
  let parsed: ReturnType<
    typeof parseArgs<{ options: typeof CLI_OPTIONS; allowPositionals: true }>
  >;
  try {
    parsed = parseArgs({
      args,
      options: CLI_OPTIONS,
      allowPositionals: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n${colors.red(colors.bold('Error:'))} ${msg}`);
    console.error(
      colors.gray("Run 'diffra --help' for a list of available options.\n"),
    );
    return 1;
  }
  const { values, positionals } = parsed;

  if (values.version) {
    console.log(`diffra v${VERSION}`);
    return 0;
  }

  const command = positionals[0] || 'test';
  // With --json, stdout carries only JSON, so human-readable text goes to stderr.
  const out = values.json ? console.error : console.log;

  if (values.help || command === 'help') {
    printHelp();
    return 0;
  }

  switch (command) {
    case 'test': {
      out(
        `\n${colors.bold(colors.cyan('Diffra Visual Regression Engine'))} v${VERSION}\n`,
      );
      const startTime = Date.now();

      try {
        const snapshotOverrides: Record<string, unknown> = {};
        const runnerOverrides: Record<string, unknown> = {};
        const storageOverrides: Record<string, unknown> = {};

        const rawThreshold = values['diff-threshold'];
        if (rawThreshold) {
          snapshotOverrides.diffThreshold = parseFloat(rawThreshold);
        }
        if (values.delay) {
          snapshotOverrides.delay = parseInt(values.delay, 10);
        }
        if (values.branch) {
          runnerOverrides.baselineBranch = values.branch;
        }
        if (values.concurrency) {
          runnerOverrides.concurrency = parseInt(values.concurrency, 10);
        }
        if (values.shard) {
          runnerOverrides.shard = values.shard;
        }
        if (values['output-dir']) {
          storageOverrides.outputDir = values['output-dir'];
        }

        const overrides: Record<string, unknown> = {};
        if (values.driver) {
          if (values.driver === 'storybook' && values.url) {
            overrides.drivers = {
              driver: 'storybook',
              url: values.url,
            };
          } else if (values.driver === 'url') {
            const urlList = values.urls
              ? values.urls
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : ['/'];
            overrides.drivers = {
              driver: 'url',
              baseUrl: values.url,
              urls: urlList,
            };
          } else {
            overrides.drivers = values.driver;
          }
        } else if (values.url) {
          overrides.drivers = {
            driver: 'storybook',
            url: values.url,
          };
        }

        if (values.filter) {
          runnerOverrides.filter = values.filter;
        }

        if (values.gate !== undefined) {
          if (values.gate !== 'any' && values.gate !== 'collateral') {
            throw new Error(
              `--gate must be "any" or "collateral", not "${values.gate}".`,
            );
          }
          overrides.agent = { gate: values.gate };
        }

        if (Object.keys(snapshotOverrides).length > 0)
          overrides.snapshot = snapshotOverrides;
        if (Object.keys(runnerOverrides).length > 0)
          overrides.runner = runnerOverrides;
        if (Object.keys(storageOverrides).length > 0)
          overrides.storage = storageOverrides;

        const report = await runVisualRegression({
          config: Object.keys(overrides).length > 0 ? overrides : undefined,
          configFile: values.config,
          shard: values.shard,
          onProgress:
            values.ci || values.json
              ? undefined
              : (step, current, total) => {
                  process.stdout.write(
                    `\r${colors.gray('►')} ${colors.white(step)} [${current}/${total}]`,
                  );
                },
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        if (!values.json) process.stdout.write(`\r${' '.repeat(80)}\r`);

        out(
          `${colors.bold('Test Run Summary')} ${colors.gray(`(${elapsed}s)`)}:`,
        );
        const branch = report.git?.branch || 'main';
        const commit = report.git?.commit || '';
        const baselineCommit = report.git?.baselineCommit;

        out(`  ${colors.bold('Branch:')}    ${colors.cyan(branch)}`);
        out(
          `  ${colors.bold('Commit:')}    ${colors.gray(commit.slice(0, 8))}`,
        );
        out(
          `  ${colors.bold('Baseline:')}  ${colors.gray(baselineCommit ? baselineCommit.slice(0, 8) : 'None')}`,
        );
        out('');

        out(
          `  ${colors.green('●')} Added:     ${colors.bold(report.summary.added)}`,
        );
        out(
          `  ${colors.yellow('●')} Changed:   ${colors.bold(report.summary.changed)}`,
        );
        out(
          `  ${colors.red('●')} Removed:   ${colors.bold(report.summary.removed)}`,
        );
        out(
          `  ${colors.red('●')} Failed:    ${colors.bold(report.summary.failed)}`,
        );
        out(
          `  ${colors.gray('●')} Passed:    ${colors.bold(report.summary.passed ?? report.summary.unchanged)}`,
        );
        out(`  ${colors.bold('Total:')}      ${report.summary.total}`);
        out('');

        if (report.summary.failed > 0) {
          out(colors.red(colors.bold('Failed Targets:')));
          for (const item of report.results.filter(
            (r) => r.status === 'failed',
          )) {
            const groupName = item.group || 'Component';
            out(
              `  ${colors.red('×')} ${colors.bold(groupName)} / ${item.name} ${colors.gray(item.error ?? '')}`,
            );
          }
          out('');
        }

        if (report.summary.changed > 0) {
          out(colors.yellow(colors.bold('Changed Targets:')));
          for (const item of report.results.filter(
            (r) => r.status === 'changed',
          )) {
            const diffPct = item.diff
              ? `${item.diff.diffPercentage.toFixed(2)}%`
              : '';
            const diffCount = item.diff
              ? `(${item.diff.diffCount.toLocaleString()} px)`
              : '';
            const groupName = item.group || 'Component';
            out(
              `  ${colors.yellow('×')} ${colors.bold(groupName)} / ${item.name} [${item.viewport.width}x${item.viewport.height}] ${colors.gray(diffPct)} ${colors.gray(diffCount)}`,
            );
          }
          out('');
        }

        const reviewPage = pathToFileURL(
          path.join(report.reviewDir, BUNDLE_INDEX_FILE),
        ).href;
        out(`${colors.cyan('Review:')} ${reviewPage}\n`);
        if (values.open) {
          openInBrowser(reviewPage);
        }

        if (values['update-baseline'] && report.summary.changed > 0) {
          const approval = await approveBaselines({
            config: Object.keys(overrides).length > 0 ? overrides : undefined,
            configFile: values.config,
            report,
          });
          if (approval.failed > 0) {
            console.error(
              `${colors.red(colors.bold('Error:'))} ${approval.failed} baseline(s) could not be promoted.`,
            );
            return 1;
          }
          out(
            colors.green(
              colors.bold(
                `Automatically approved ${report.summary.changed} changed baseline(s).`,
              ),
            ),
          );
        }

        const needed = decisionsNeeded(report);
        if (values.json) {
          console.log(JSON.stringify(report, null, 2));
          if (report.summary.failed > 0) {
            return 1;
          }
          if (
            needed > 0 &&
            !values['pass-on-changes'] &&
            !values['update-baseline']
          ) {
            return 1;
          }
          return 0;
        }

        if (report.summary.failed > 0) {
          out(
            colors.red(
              colors.bold(
                `Visual regression test failed: ${report.summary.failed} target(s) could not be captured.`,
              ),
            ),
          );
          return 1;
        }

        if (
          needed > 0 &&
          !values['pass-on-changes'] &&
          !values['update-baseline']
        ) {
          out(
            colors.red(
              colors.bold(
                report.gate === 'collateral'
                  ? `Visual regression test failed with ${needed} change(s) that no declared intent covers.`
                  : `Visual regression test failed with ${needed} changed targets.`,
              ),
            ),
          );
          out(
            colors.gray(
              'Run `diffra approve` to accept changes as the new baseline.\n',
            ),
          );
          return 1;
        }

        out(
          colors.green(
            colors.bold('All visual regression tests passed cleanly.'),
          ),
        );
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `\n${colors.red(colors.bold('Error running Diffra:'))} ${msg}`,
        );
        return 1;
      }
    }

    case 'approve': {
      out(`\n${colors.bold(colors.cyan('Diffra Baseline Approval'))}\n`);
      try {
        const ids = positionals.slice(1);
        const result = await approveBaselines({
          configFile: values.config,
          ids,
          provenance: { actor: 'human', rationale: values.rationale },
        });
        if (values.json) {
          console.log(
            JSON.stringify({ approved: result.count, failed: result.failed }),
          );
          return result.failed > 0 ? 1 : 0;
        }
        if (result.failed > 0) {
          console.error(
            `${colors.red(colors.bold('Error:'))} ${result.failed} baseline(s) could not be promoted, and ${result.count} were.\n`,
          );
          return 1;
        }
        out(
          `${colors.green(colors.bold('Successfully approved'))} ${result.count} screenshots as baseline.\n`,
        );
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `${colors.red(colors.bold('Error approving baselines:'))} ${msg}\n`,
        );
        return 1;
      }
    }

    case 'status': {
      try {
        const cwd = process.cwd();
        const config = await loadConfig(cwd, undefined, values.config);
        const report = await loadRunReport(config, cwd);
        if (values.json) {
          console.log(JSON.stringify(report, null, 2));
          return 0;
        }
        const { summary } = report;
        console.log(
          `\n${colors.bold(colors.cyan('Diffra latest run'))} ${report.runId}\n`,
        );
        console.log(`  ${colors.bold('Branch:')}   ${report.git.branch}`);
        console.log(`  ${colors.bold('Changed:')}  ${summary.changed}`);
        console.log(`  ${colors.bold('Added:')}    ${summary.added}`);
        console.log(`  ${colors.bold('Removed:')}  ${summary.removed}`);
        console.log(`  ${colors.bold('Failed:')}   ${summary.failed}`);
        console.log(`  ${colors.bold('Total:')}    ${summary.total}\n`);
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red(colors.bold('Error:'))} ${msg}`);
        return 1;
      }
    }

    case 'prove': {
      try {
        const id = positionals[1];
        if (!id) throw new Error('Pass the id of the snapshot to prove.');
        const { explanation } = await proveSnapshot({
          configFile: values.config,
          id,
        });
        if (values.json) {
          console.log(JSON.stringify(explanation, null, 2));
        } else {
          out(explanation.summary);
          if (explanation.proof) out(colors.gray(explanation.proof.note));
        }
        return explanation.proof?.status === 'proven' ? 0 : 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red(colors.bold('Error:'))} ${msg}`);
        return 1;
      }
    }

    case 'verify': {
      try {
        const { report, verification, affected } = await verifyRun({
          configFile: values.config,
          affected: values.affected,
          config: values.filter
            ? { runner: { filter: values.filter } }
            : undefined,
        });
        if (values.json) {
          console.log(
            JSON.stringify(
              {
                runId: report.runId,
                summary: report.summary,
                verification,
                affected,
              },
              null,
              2,
            ),
          );
        } else {
          out(verification.summary);
          if (affected) {
            out(
              colors.gray(
                `${affected.ran === 'affected' ? `Captured ${affected.ids.length} affected snapshot(s). ` : 'Captured everything. '}${affected.note}`,
              ),
            );
          }
        }
        return verification.stillChanged.length +
          verification.newlyChanged.length >
          0
          ? 1
          : 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red(colors.bold('Error:'))} ${msg}`);
        return 1;
      }
    }

    case 'fix': {
      try {
        const id = positionals[1];
        if (!id) throw new Error('Pass the id of the snapshot to fix.');
        const cwd = process.cwd();
        const config = await loadConfig(cwd, undefined, values.config);
        const report = await loadRunReport(config, cwd);
        const result = report.results.find((r) => r.id === id);
        if (!result) throw new Error(`No snapshot "${id}" in the latest run.`);
        if (!result.explanation) {
          throw new Error(
            `"${id}" has no explanation, so there is nothing to undo.`,
          );
        }
        const fixes = await suggestFixes({
          explanation: result.explanation,
          cwd,
        });
        if (values.json) {
          console.log(JSON.stringify(fixes, null, 2));
        } else {
          // Standard output is only the patch, so it can be piped to git apply.
          for (const suggestion of fixes.suggestions) {
            if (suggestion.patch) process.stdout.write(suggestion.patch);
            else console.error(suggestion.note);
          }
          if (fixes.suggestions.length === 0) console.error(fixes.note);
        }
        return fixes.suggestions.some((s) => s.patch) ? 0 : 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red(colors.bold('Error:'))} ${msg}`);
        return 1;
      }
    }

    case 'intent': {
      try {
        const cwd = process.cwd();
        const config = await loadConfig(cwd, undefined, values.config);
        const file = path.resolve(
          cwd,
          config.agent?.intentFile ?? DEFAULT_INTENT_FILE,
        );
        const action = positionals[1] ?? 'list';

        if (action === 'add') {
          const intent = await addIntent(file, {
            description: positionals.slice(2).join(' '),
            targets: values.target,
            sources: values.source,
            selectors: values.selector,
          });
          if (values.json) console.log(JSON.stringify(intent, null, 2));
          else out(`Declared ${colors.bold(intent.id)}: ${intent.description}`);
          return 0;
        }
        if (action === 'list') {
          const intents = await readIntents(file);
          if (values.json) console.log(JSON.stringify(intents, null, 2));
          else if (intents.length === 0) out('No intent is declared.');
          else {
            for (const intent of intents) {
              out(`${colors.bold(intent.id)}  ${intent.description}`);
            }
          }
          return 0;
        }
        if (action === 'clear') {
          const ids = positionals.slice(2);
          const removed = await clearIntents(
            file,
            ids.length > 0 ? ids : undefined,
          );
          if (values.json) console.log(JSON.stringify({ removed }));
          else out(`Removed ${removed} intent${removed === 1 ? '' : 's'}.`);
          return 0;
        }
        throw new Error(
          `Unknown intent command "${action}". Use add, list or clear.`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red(colors.bold('Error:'))} ${msg}`);
        return 1;
      }
    }

    case 'agent': {
      try {
        const action = positionals[1] ?? 'init';
        if (action !== 'init') {
          throw new Error(`Unknown agent command "${action}". Use init.`);
        }
        const steps = await setupAgent({
          cwd: process.cwd(),
          skill: !values['no-skill'],
          force: values.force,
        });
        if (values.json) {
          console.log(JSON.stringify(steps, null, 2));
        } else {
          for (const step of steps) {
            out(`${step.status.padEnd(9)} ${step.file}`);
            if (step.note) out(colors.gray(`          ${step.note}`));
          }
          out(
            '\nRestart your agent, then ask it to check the visual changes in this branch and fix any it did not intend.',
          );
        }
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red(colors.bold('Error:'))} ${msg}`);
        return 1;
      }
    }

    case 'mcp': {
      // Standard output belongs to the protocol from here on.
      await startMcpServer({
        configFile: values.config,
        report: values.report,
      });
      return 0;
    }

    case 'merge-reports': {
      console.log(
        `\n${colors.bold(colors.cyan('Diffra Shard Report Merger'))}\n`,
      );
      const cliShardDirs = values['shard-dir']
        ? Array.isArray(values['shard-dir'])
          ? values['shard-dir']
          : [values['shard-dir']]
        : [];
      const shardDirs = [...cliShardDirs, ...positionals.slice(1)];
      const outDir = values['output-dir'] || '.diffra';

      if (shardDirs.length === 0) {
        console.error(
          colors.red('Usage: diffra merge-reports <shardPaths...> [options]'),
        );
        return 1;
      }

      try {
        const merged = await mergeReports(shardDirs, { outputDir: outDir });
        console.log(
          `${colors.green(colors.bold('Successfully merged'))} ${merged.results.length} visual results across ${shardDirs.length} shards into ${colors.cyan(outDir)}.\n`,
        );
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `${colors.red(colors.bold('Error merging shard reports:'))} ${msg}\n`,
        );
        return 1;
      }
    }

    case 'serve': {
      const port = values.port ? parseInt(values.port, 10) : undefined;
      let instance: Awaited<ReturnType<typeof startServeServer>>;
      try {
        instance = await startServeServer({
          reportPath: values.report,
          outputDir: values['output-dir'],
          port,
        });
      } catch (error) {
        console.error(
          `\n${colors.red(error instanceof Error ? error.message : String(error))}`,
        );
        return 1;
      }
      const { server, url, stop } = instance;

      console.log(`\n${colors.bold(colors.cyan('Diffra Report Viewer'))}`);
      console.log(
        `${colors.green('✓')} Review report at: ${colors.bold(colors.underline(url))}\n`,
      );

      if (values.ci || process.env.NODE_ENV === 'test') {
        await stop();
        return 0;
      }

      console.log(colors.gray('Press Ctrl+C to stop the preview server.\n'));

      await new Promise<void>((resolve) => {
        const onSignal = async () => {
          process.off('SIGINT', onSignal);
          process.off('SIGTERM', onSignal);
          await stop();
          resolve();
        };
        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);
        server.on('close', () => resolve());
      });
      return 0;
    }

    default: {
      console.error(`\n${colors.red(`Unknown command: "${command}"`)}`);
      printHelp();
      return 1;
    }
  }
}

// Auto-run if executed as main CLI entry point
if (process.argv[1]) {
  const fileUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === fileUrl) {
    main().then(
      (code) => {
        process.exitCode = code;
      },
      (error) => {
        console.error(error);
        process.exitCode = 1;
      },
    );
  }
}
