import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  approveBaselines,
  runVisualRegression,
  serveReport,
} from '@diffra/core';
import { colors } from './utils/colors.js';

const VERSION = '0.1.0';

export function printHelp(): void {
  console.log(`
${colors.bold('diffra')} v${VERSION}
Ultra-fast, general-purpose visual regression testing engine for Storybook, web apps, and design systems

${colors.bold('Usage:')}
  diffra <command> [options]

${colors.bold('Commands:')}
  test       Execute visual regression tests against configured targets
  approve    Approve candidate screenshots as the new baseline
  serve      Start the local review report server

${colors.bold('Options:')}
  -h, --help                  Show help information
  -v, --version               Show version number

${colors.bold('Command Options (test):')}
  -d, --driver <name>         Visual driver: 'storybook', 'url', or 'image' (default: storybook)
  -u, --url <url>             Base URL or Storybook server URL (default: http://localhost:6006)
  --urls <list>               Comma-separated list of web URLs / paths to test
  -c, --config <path>         Path to custom configuration file
  -b, --branch <branch>       Target baseline git branch (default: origin/main)
  -t, --diff-threshold <num>  Perceptual diff threshold (default: 0.063)
  --threshold <num>           Alias for diff-threshold
  -o, --output-dir <dir>      Output directory for reports (default: .diffra)
  --concurrency <number>      Number of parallel browser workers (default: 4)
  --delay <ms>                Settle wait time in ms after component render
  --pass-on-changes           Exit with status 0 even if visual differences are found
  --open                      Automatically open the visual report in browser

${colors.bold('Command Options (serve):')}
  -p, --port <number>         Port for review server (default: 9000)
  -r, --report <path>         Path to custom report HTML file

${colors.bold('Examples:')}
  diffra test
  diffra test --driver url --urls "/,/pricing,/dashboard"
  diffra test --url http://127.0.0.1:8080 --diff-threshold 0.05
  diffra approve
  diffra serve --port 3000
`);
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
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
      'pass-on-changes': { type: 'boolean' },
      open: { type: 'boolean' },
      port: { type: 'string', short: 'p' },
      report: { type: 'string', short: 'r' },
    },
    allowPositionals: true,
    strict: false,
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
        const overrides: Record<string, unknown> = {};
        if (values.driver) overrides.driver = values.driver as string;
        if (values.url) overrides.storybookUrl = values.url as string;
        if (values.urls) {
          overrides.urls = (values.urls as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (values.branch) overrides.baselineBranch = values.branch as string;
        const rawThreshold =
          (values['diff-threshold'] as string) || (values.threshold as string);
        if (rawThreshold) {
          overrides.diffThreshold = parseFloat(rawThreshold);
          overrides.threshold = parseFloat(rawThreshold);
        }
        if (values.delay)
          overrides.delay = parseInt(values.delay as string, 10);
        if (values['output-dir'])
          overrides.outputDir = values['output-dir'] as string;
        if (values.concurrency)
          overrides.concurrency = parseInt(values.concurrency as string, 10);

        const report = await runVisualRegression({
          config: overrides,
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
        console.log(
          `  ${colors.bold('Branch:')}    ${colors.cyan(report.branch)}`,
        );
        console.log(
          `  ${colors.bold('Commit:')}    ${colors.gray(report.commit.slice(0, 8))}`,
        );
        console.log(
          `  ${colors.bold('Baseline:')}  ${colors.gray(report.baselineCommit ? report.baselineCommit.slice(0, 8) : 'None')}`,
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
          `  ${colors.gray('●')} Passed:    ${colors.bold(report.summary.unchanged)}`,
        );
        console.log(`  ${colors.bold('Total:')}      ${report.summary.total}`);
        console.log('');

        if (report.summary.changed > 0) {
          console.log(colors.yellow(colors.bold('Changed Targets:')));
          for (const item of report.results.filter(
            (r) => r.status === 'changed',
          )) {
            const diffPct = item.diffResult
              ? `${item.diffResult.diffPercentage.toFixed(2)}%`
              : '';
            const diffCount = item.diffResult
              ? `(${item.diffResult.diffCount.toLocaleString()} px)`
              : '';
            const groupName = item.group || item.component;
            console.log(
              `  ${colors.yellow('×')} ${colors.bold(groupName)} / ${item.name} [${item.viewport.width}x${item.viewport.height}] ${colors.gray(diffPct)} ${colors.gray(diffCount)}`,
            );
          }
          console.log('');
        }

        const reportHtmlPath = path.resolve(
          process.cwd(),
          (values['output-dir'] as string) || '.diffra',
          'runs',
          report.runId,
          'index.html',
        );
        console.log(
          `${colors.cyan('Visual Report:')} file://${reportHtmlPath}\n`,
        );

        if (values.open) {
          const { url } = await serveReport(reportHtmlPath, 9000);
          console.log(
            `${colors.green('✓')} Review server active at ${colors.bold(url)} (Press Ctrl+C to exit)`,
          );
          await new Promise(() => {});
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

    case 'serve': {
      let reportPath = values.report as string;
      const port = values.port ? parseInt(values.port as string, 10) : 9000;

      if (!reportPath) {
        const latestPath = path.resolve(
          process.cwd(),
          '.diffra/latest-report.json',
        );
        try {
          const content = await fs.readFile(latestPath, 'utf-8');
          const report = JSON.parse(content);
          reportPath = path.resolve(
            process.cwd(),
            '.diffra/runs',
            report.runId,
            'index.html',
          );
        } catch {
          reportPath = path.resolve(process.cwd(), '.diffra/report.html');
        }
      }

      try {
        const { url } = await serveReport(reportPath, port);
        console.log(`\n${colors.bold(colors.cyan('Diffra Report Viewer'))}`);
        console.log(
          `${colors.green('✓')} Review report live at ${colors.bold(colors.underline(url))}\n`,
        );
        console.log(colors.gray('Press Ctrl+C to stop server.\n'));
        await new Promise(() => {});
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `${colors.red(colors.bold('Error starting server:'))} ${msg}\n`,
        );
        return 1;
      }
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
