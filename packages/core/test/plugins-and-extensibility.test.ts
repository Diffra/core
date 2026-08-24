import { describe, expect, it, vi } from 'vitest';
import {
  createAzureStorage,
  createGCSStorage,
  createLocalStorage,
  createS3Storage,
  createSlackNotifier,
  type DiffEngineAdapter,
  type DiffraPlugin,
  type NotifierAdapter,
  resolveDiffEngine,
  resolveNotifiers,
  resolveStorageAdapter,
  type StorageAdapter,
  type TestRunReport,
} from '../src/index.js';
import { PluginRunner } from '../src/plugins/runner.js';

describe('Modular Plugin & Extensibility System', () => {
  it('allows custom downstream StorageAdapter object', async () => {
    const customUploadCandidate = vi
      .fn()
      .mockResolvedValue('https://custom-storage.internal/img.png');
    const customDownloadBaseline = vi.fn().mockResolvedValue(null);
    const customSaveReport = vi.fn().mockResolvedValue('/tmp/report.json');

    const customStorage: StorageAdapter = {
      name: 'my-custom-sftp-or-db-storage',
      uploadCandidate: customUploadCandidate,
      uploadDiff: vi.fn(),
      downloadBaseline: customDownloadBaseline,
      uploadBaseline: vi.fn(),
      saveReport: customSaveReport,
    };

    const resolved = resolveStorageAdapter({ storage: customStorage });
    expect(resolved.name).toBe('my-custom-sftp-or-db-storage');

    const uploaded = await resolved.uploadCandidate(
      'run-1',
      'btn',
      { width: 800, height: 600 },
      Buffer.from('png'),
    );
    expect(uploaded).toBe('https://custom-storage.internal/img.png');
    expect(customUploadCandidate).toHaveBeenCalled();
  });

  it('supports built-in storage factory drivers (local, S3, GCS, Azure)', () => {
    const local = createLocalStorage({ outputDir: '.custom-out' });
    expect(local.name).toBe('local');

    const s3 = createS3Storage({ bucket: 'my-bucket', region: 'eu-west-1' });
    expect(s3.name).toBe('s3');

    const gcs = createGCSStorage({ bucket: 'my-gcs-bucket' });
    expect(gcs.name).toBe('gcs');

    const azure = createAzureStorage({
      container: 'my-container',
      connectionString: 'DefaultEndpointsProtocol=https...',
    });
    expect(azure.name).toBe('azure');
  });

  it('supports custom NotifierAdapter and built-in notifiers (GitHub, Slack)', async () => {
    const customNotify = vi.fn().mockResolvedValue(undefined);
    const customNotifier: NotifierAdapter = {
      name: 'internal-datadog-or-pagerduty',
      notify: customNotify,
    };

    const notifiers = resolveNotifiers({
      notifiers: [
        customNotifier,
        createSlackNotifier({
          webhookUrl: 'https://hooks.slack.com/services/...',
        }),
      ],
    });

    expect(notifiers.length).toBe(2);
    expect(notifiers[0].name).toBe('internal-datadog-or-pagerduty');
    expect(notifiers[1].name).toBe('slack');

    const dummyReport: TestRunReport = {
      runId: 'run-123',
      timestamp: new Date().toISOString(),
      branch: 'feature-extensibility',
      commit: 'abc1234',
      summary: { total: 10, changed: 1, added: 0, removed: 0, unchanged: 9 },
      results: [],
    };

    await notifiers[0].notify(dummyReport);
    expect(customNotify).toHaveBeenCalledWith(dummyReport);
  });

  it('supports custom DiffEngineAdapter', async () => {
    const customCompare = vi.fn().mockResolvedValue({
      hasDiff: false,
      diffPercentage: 0,
      diffCount: 0,
      totalPixels: 1000,
      boundingBoxes: [],
    });

    const customDiffEngine: DiffEngineAdapter = {
      name: 'ai-perceptual-diff-engine',
      compare: customCompare,
    };

    const engine = resolveDiffEngine({ diffEngine: customDiffEngine });
    expect(engine.name).toBe('ai-perceptual-diff-engine');

    const result = await engine.compare(Buffer.from('a'), Buffer.from('b'));
    expect(result.hasDiff).toBe(false);
    expect(customCompare).toHaveBeenCalled();
  });

  it('executes full plugin lifecycle hooks via PluginRunner', async () => {
    const hookEvents: string[] = [];

    const testPlugin: DiffraPlugin = {
      name: 'audit-plugin',
      setup: () => {
        hookEvents.push('setup');
      },
      onDiscoverStories: (stories) => {
        hookEvents.push('onDiscoverStories');
        // Filter or modify stories
        return stories.map((s) => ({ ...s, name: `[Audited] ${s.name}` }));
      },
      onBeforeCapture: () => {
        hookEvents.push('onBeforeCapture');
      },
      onAfterCapture: (_story, _vp, buf) => {
        hookEvents.push('onAfterCapture');
        return buf;
      },
      onTestComplete: () => {
        hookEvents.push('onTestComplete');
      },
    };

    const runner = new PluginRunner([testPlugin]);
    await runner.hookSetup({});

    const transformedStories = await runner.hookDiscoverStories([
      { id: '1', name: 'Primary', component: 'Button', title: 'Button' },
    ]);
    expect(transformedStories[0].name).toBe('[Audited] Primary');

    await runner.hookBeforeCapture(transformedStories[0], {
      width: 800,
      height: 600,
    });
    const buf = await runner.hookAfterCapture(
      transformedStories[0],
      { width: 800, height: 600 },
      Buffer.from('test'),
    );
    expect(buf.toString()).toBe('test');

    await runner.hookTestComplete({
      runId: 'run-1',
      timestamp: '',
      branch: 'main',
      commit: '123',
      summary: { total: 1, changed: 0, added: 0, removed: 0, unchanged: 1 },
      results: [],
    });

    expect(hookEvents).toEqual([
      'setup',
      'onDiscoverStories',
      'onBeforeCapture',
      'onAfterCapture',
      'onTestComplete',
    ]);
  });
});
