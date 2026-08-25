# Notification adapters

Notifiers execute at the conclusion of a visual regression test run to update commit status checks, publish pull request summaries, or send alert cards to communication channels.

---

## 1. GitHub notifier

The GitHub notifier creates or updates a single sticky comment on pull requests and reports commit check statuses under `diffra/visual-tests`:

```typescript
import { defineConfig } from '@diffra/core/config';
import { createGitHubNotifier } from '@diffra/core/plugins';

export default defineConfig({
  reporters: [
    createGitHubNotifier({
      token: process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPOSITORY,
      prNumber: process.env.GITHUB_PR_NUMBER ? parseInt(process.env.GITHUB_PR_NUMBER, 10) : undefined,
      viewerUrl: 'https://my-org.github.io/my-repo',
    }),
  ],
});
```

### Sticky PR comment format
Diffra uses an invisible HTML marker (`<!-- diffra-comment-marker -->`) to ensure that re-running tests updates the existing PR comment rather than generating comment spam.

---

## 2. Slack webhook notifier

Posts structured cards with pass/fail metrics, changed component counts, and report links to a Slack channel:

```typescript
import { defineConfig } from '@diffra/core/config';
import { createSlackNotifier } from '@diffra/core/plugins';

export default defineConfig({
  reporters: [
    createSlackNotifier({
      webhookUrl: process.env.SLACK_WEBHOOK_URL!,
      channel: '#design-system-ci',
    }),
  ],
});
```

---

## 3. Custom notifier implementation

Implement the `NotifierAdapter` interface to send test results to Microsoft Teams, Discord, Datadog, or internal webhooks:

```typescript
import { defineConfig } from '@diffra/core/config';
import type { NotifierAdapter } from '@diffra/core';

const customWebhookNotifier: NotifierAdapter = {
  name: 'custom-webhook-notifier',
  async notify(report) {
    await fetch('https://api.internal.net/webhooks/visual-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: report.git?.branch,
        commit: report.git?.commit,
        total: report.summary.total,
        changed: report.summary.changed,
        passed: report.summary.passed ?? report.summary.unchanged,
        reportUrl: report.links?.reportUrl,
      }),
    });
  },
};

export default defineConfig({
  reporters: [customWebhookNotifier],
});
```
