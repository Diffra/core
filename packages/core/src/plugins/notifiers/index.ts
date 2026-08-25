export * from './github.js';
export * from './slack.js';
export * from './summary.js';

import type { DiffraConfig, NotifierAdapter } from '../../types/index.js';
import { createGitHubNotifier } from './github.js';
import { createSlackNotifier } from './slack.js';

export function resolveNotifiers(config: DiffraConfig): NotifierAdapter[] {
  const notifiers: NotifierAdapter[] = [];
  const reporters = config.reporters || [];

  for (const r of reporters) {
    if (typeof r === 'string') {
      if (r === 'github') notifiers.push(createGitHubNotifier());
      else if (r === 'slack' && process.env.SLACK_WEBHOOK_URL) {
        notifiers.push(
          createSlackNotifier({ webhookUrl: process.env.SLACK_WEBHOOK_URL }),
        );
      }
    } else if (typeof r === 'object') {
      if ('type' in r) {
        if (r.type === 'github') notifiers.push(createGitHubNotifier(r));
        else if (r.type === 'slack') notifiers.push(createSlackNotifier(r));
      } else if ('notify' in r) {
        notifiers.push(r as NotifierAdapter);
      }
    }
  }

  if (
    notifiers.length === 0 &&
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_REPOSITORY
  ) {
    notifiers.push(createGitHubNotifier());
  }

  return notifiers;
}
