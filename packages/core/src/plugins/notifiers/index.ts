export * from './github.js';
export * from './slack.js';

import type { DiffraConfig, NotifierAdapter } from '../../types/index.js';
import { createGitHubNotifier } from './github.js';

export function resolveNotifiers(config: DiffraConfig): NotifierAdapter[] {
  const notifiers: NotifierAdapter[] = [];

  if (config.notifiers && Array.isArray(config.notifiers)) {
    notifiers.push(...config.notifiers);
  }

  // Legacy config backward compatibility
  if (config.notifier?.github) {
    notifiers.push(createGitHubNotifier(config.notifier.github));
  } else if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    notifiers.push(createGitHubNotifier());
  }

  return notifiers;
}
