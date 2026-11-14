# Hosting review reports

Every run writes a review bundle, a static directory that is a complete review site. Hosting reports means choosing where people open that directory. See [Review bundle](../architecture/review-bundle.md) for the layout and the rules for image references.

---

## Option 1: Workflow artifact (no infrastructure)

Give the Diffra step an `id` and upload its `reportDir` output as an artifact. Without a `reportBaseUrl`, the pull request links to the workflow run, where the artifact is listed.

```yaml
- name: Run Diffra Action
  id: diffra
  uses: Diffra/core@v1

- name: Upload review bundle
  if: always()
  uses: actions/upload-artifact@v7
  with:
    name: diffra-report
    path: ${{ steps.diffra.outputs.reportDir }}
```

Download the artifact, unzip it, and open `index.html`. It works from disk with no server.

---

## Option 2: Publish the output directory

Publish the contents of `.diffra/` to any static host and tell Diffra where it lives with `reportBaseUrl`. Review links then point at `<reportBaseUrl>/runs/<runId>/`, and reviewers open them in the browser with no download.

```typescript
export default defineConfig({
  reportBaseUrl: 'https://my-org.github.io/my-repo',
});
```

The same setting is available as the `reportBaseUrl` action input and the `DIFFRA_REPORT_BASE_URL` environment variable.

### GitHub Pages

```yaml
- name: Upload review reports
  uses: actions/upload-pages-artifact@v5
  with:
    path: '.diffra'

- name: Deploy to GitHub Pages
  uses: actions/deploy-pages@v5
```

Pages sites are public unless your plan makes them private, so publish only what you are happy to share.

### Amazon S3, Cloudflare R2, or any bucket with static hosting

```bash
aws s3 sync .diffra/ s3://my-visual-reports-bucket/
```

Set `reportBaseUrl` to the public address of the bucket. Baselines are stored separately by the [storage adapter](../storage-and-plugins/storage-adapters.md), so the bucket you publish reports from does not need to be the one that holds baselines.

---

## Option 3: Local review server

When developing locally:

```bash
# Serve the latest run on a free port
diffra serve

# Serve a specific run on a chosen port
diffra serve --port 3000 --report .diffra/runs/run-1708701234
```

---

## Using a hosted copy of the review interface

A copy of the review interface can load any published `report.json` with `?report=<url>`. Relative image URLs in the report resolve against the report's own address.
