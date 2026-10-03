import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  approveBaselines,
  buildViewerUrl,
  mergeReports,
  runVisualRegression,
} from '@diffra/core';
import { colors } from './utils/colors.js';

const VERSION = '0.1.0';

export function printHelp(): void {
  console.log(`
${colors.bold(colors.cyan('Diffra Visual Regression CLI'))} v${VERSION}

${colors.bold('Usage:')}
  diffra [command] [options]

${colors.bold('Commands:')}
  test           Run visual regression suite (default)
  approve        Approve candidate screenshots as the new baseline
  merge-reports  Merge multiple shard report manifests into a consolidated run
  serve          Open local static review viewer for inspection
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
      --pass-on-changes       Exit with 0 even if visual differences are detected
      --open                  Open review report in browser after test run
  -p, --port <number>         Custom port for preview server
  -r, --report <path>         Report JSON path to serve
  -v, --version               Display version
  -h, --help                  Show this help information

${colors.bold('Examples:')}
  diffra
  diffra -d storybook -u http://127.0.0.1:6006
  diffra -d url -u http://127.0.0.1:3000 --urls /,/about,/pricing
  diffra --shard 1/4
  diffra approve
  diffra merge-reports .diffra/shard-1 .diffra/shard-2 -o .diffra
  diffra serve --port 3000
`);
}

const CLI_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  driver: { type: 'string', short: 'd' },
  url: { type: 'string', short: 'u' },
  urls: { type: 'string' },
  config: { type: 'string', short: 'c' },
  branch: { type: 'string', short: 'b' },
  'diff-threshold': { type: 'string', short: 't' },
  threshold: { type: 'string' },
  delay: { type: 'string' },
  'output-dir': { type: 'string', short: 'o' },
  concurrency: { type: 'string' },
  shard: { type: 'string' },
  'pass-on-changes': { type: 'boolean' },
  open: { type: 'boolean' },
  port: { type: 'string', short: 'p' },
  report: { type: 'string', short: 'r' },
  'viewer-url': { type: 'string' },
} as const;

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: CLI_OPTIONS,
    allowPositionals: true,
  });

  if (values.version) {
    console.log(`diffra v${VERSION}`);
    return 0;
  }

  const command = positionals[0] || 'test';

  if (values.help || command === 'help') {
    printHelp();
    return 0;
  }

  switch (command) {
    case 'test': {
      console.log(
        `\n${colors.bold(colors.cyan('Diffra Visual Regression Engine'))} v${VERSION}\n`,
      );
      const startTime = Date.now();

      try {
        const snapshotOverrides: Record<string, unknown> = {};
        const runnerOverrides: Record<string, unknown> = {};
        const storageOverrides: Record<string, unknown> = {};

        const rawThreshold = values['diff-threshold'] || values.threshold;
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

        if (Object.keys(snapshotOverrides).length > 0)
          overrides.snapshot = snapshotOverrides;
        if (Object.keys(runnerOverrides).length > 0)
          overrides.runner = runnerOverrides;
        if (Object.keys(storageOverrides).length > 0)
          overrides.storage = storageOverrides;

        const report = await runVisualRegression({
          config: overrides,
          shard: values.shard,
          onProgress: (step, current, total) => {
            process.stdout.write(
              `\r${colors.gray('►')} ${colors.white(step)} [${current}/${total}]`,
            );
          },
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        process.stdout.write(`\r${' '.repeat(80)}\r`);

        console.log(
          `${colors.bold('Test Run Summary')} ${colors.gray(`(${elapsed}s)`)}:`,
        );
        const branch = report.git?.branch || 'main';
        const commit = report.git?.commit || '';
        const baselineCommit = report.git?.baselineCommit;

        console.log(`  ${colors.bold('Branch:')}    ${colors.cyan(branch)}`);
        console.log(
          `  ${colors.bold('Commit:')}    ${colors.gray(commit.slice(0, 8))}`,
        );
        console.log(
          `  ${colors.bold('Baseline:')}  ${colors.gray(baselineCommit ? baselineCommit.slice(0, 8) : 'None')}`,
        );
        console.log('');

        console.log(
          `  ${colors.green('●')} Added:     ${colors.bold(report.summary.added)}`,
        );
        console.log(
          `  ${colors.yellow('●')} Changed:   ${colors.bold(report.summary.changed)}`,
        );
        console.log(
          `  ${colors.red('●')} Removed:   ${colors.bold(report.summary.removed)}`,
        );
        console.log(
          `  ${colors.gray('●')} Passed:    ${colors.bold(report.summary.passed ?? report.summary.unchanged)}`,
        );
        console.log(`  ${colors.bold('Total:')}      ${report.summary.total}`);
        console.log('');

        if (report.summary.changed > 0) {
          console.log(colors.yellow(colors.bold('Changed Targets:')));
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
            console.log(
              `  ${colors.yellow('×')} ${colors.bold(groupName)} / ${item.name} [${item.viewport.width}x${item.viewport.height}] ${colors.gray(diffPct)} ${colors.gray(diffCount)}`,
            );
          }
          console.log('');
        }

        const reportJsonPath = path.resolve(
          process.cwd(),
          values['output-dir'] || '.diffra',
          'runs',
          report.runId,
          'report.json',
        );
        console.log(
          `${colors.cyan('Report Manifest:')} file://${reportJsonPath}\n`,
        );
        if (values.open) {
          const viewerUrl = buildViewerUrl(
            `file://${reportJsonPath}`,
            values['viewer-url'],
          );
          console.log(
            `${colors.green('✓')} Review report at: ${colors.bold(colors.cyan(viewerUrl))}\n`,
          );
        }

        if (report.summary.changed > 0 && !values['pass-on-changes']) {
          console.log(
            colors.red(
              colors.bold(
                `Visual regression test failed with ${report.summary.changed} changed targets.`,
              ),
            ),
          );
          console.log(
            colors.gray(
              'Run `diffra approve` to accept changes as the new baseline.\n',
            ),
          );
          return 1;
        }

        console.log(
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
      console.log(
        `\n${colors.bold(colors.cyan('Diffra Baseline Approval'))}\n`,
      );
      try {
        const result = await approveBaselines();
        console.log(
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

    case 'merge-reports': {
      console.log(
        `\n${colors.bold(colors.cyan('Diffra Shard Report Merger'))}\n`,
      );
      const shardDirs = positionals.slice(1);
      const outDir = values['output-dir'] || '.diffra';

      if (shardDirs.length === 0) {
        console.error(
          colors.red(
            'Usage: diffra merge-reports <shardPaths...> -o <outputDir>',
          ),
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
      let reportPath = values.report;

      if (!reportPath) {
        reportPath = path.resolve(process.cwd(), '.diffra/latest-report.json');
      }

      const viewerUrl = buildViewerUrl(
        `file://${reportPath}`,
        values['viewer-url'],
      );
      console.log(`\n${colors.bold(colors.cyan('Diffra Report Viewer'))}`);
      console.log(
        `${colors.green('✓')} Review report at: ${colors.bold(colors.underline(viewerUrl))}\n`,
      );
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
    main().then((code) => {
      if (code !== 0) {
        process.exit(code);
      }
    });
  }
}
