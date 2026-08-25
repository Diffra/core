import type { NotifierAdapter, TestRunReport } from '../../types/index.js';

export interface SlackNotifierOptions {
  webhookUrl?: string;
  channel?: string;
}

export class SlackNotifier implements NotifierAdapter {
  name = 'slack';
  private webhookUrl?: string;
  private channel?: string;

  constructor(options: SlackNotifierOptions = {}) {
    this.webhookUrl = options.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    this.channel = options.channel;
  }

  async notify(report: TestRunReport): Promise<void> {
    if (!this.webhookUrl) return;

    const hasChanges = report.summary.changed > 0;
    const color = hasChanges ? '#f85149' : '#3fb950';
    const text = hasChanges
      ? `🚨 *Diffra Visual Test Alert*: ${report.summary.changed} changed targets detected on branch \`${report.branch}\`.`
      : `✅ *Diffra Visual Tests Passed*: All ${report.summary.total} targets verified cleanly on \`${report.branch}\`.`;

    const payload = {
      channel: this.channel,
      attachments: [
        {
          color,
          title: `Visual Regression Run: ${report.runId}`,
          text,
          fields: [
            {
              title: 'Total',
              value: String(report.summary.total),
              short: true,
            },
            {
              title: 'Changed',
              value: String(report.summary.changed),
              short: true,
            },
            {
              title: 'Added',
              value: String(report.summary.added),
              short: true,
            },
            {
              title: 'Passed',
              value: String(report.summary.unchanged),
              short: true,
            },
          ],
          footer: 'Diffra Visual Testing Engine',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }
}

export function createSlackNotifier(
  options?: SlackNotifierOptions,
): NotifierAdapter {
  return new SlackNotifier(options);
}
