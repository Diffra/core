# Self-hosted report deployment

Diffra produces static, standalone visual regression reports that can be deployed to any static hosting provider (GitHub Pages, Cloudflare Pages, Amazon S3, Cloudflare R2, Vercel, or Netlify) without recurring subscription costs.

---

## Deterministic directory structure

Diffra formats test output into a deterministic directory hierarchy that enables cross-branch baseline jumping:

```
.diffra/ (or https://<org>.github.io/<repo>/)
├── runs/
│   └── run-1708701234/
│       ├── report.json         # Complete JSON manifest for this run
│       ├── candidates/         # Candidate PNG images
│       └── diffs/              # Diff masks and heatmap assets
├── branches/
│   ├── main/
│   │   └── latest/
│   │       └── report.json     # Latest baseline report for main branch
│   └── feature_navbar/
│       └── latest/
│           └── report.json     # Latest report for feature branch
└── latest/
    └── report.json             # Global pointer to most recent run
```

---

## Strategy 1: GitHub Pages deployment

Automatically publish the latest reports to GitHub Pages on every pull request or push to `main`:

```yaml
# In .github/workflows/deploy-report.yml
name: Deploy Diffra Review UI

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload .diffra directory as artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.diffra'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Set `viewerUrl` in `diffra.config.ts` or GitHub Actions:

```typescript
export default defineConfig({
  viewerUrl: 'https://my-org.github.io/my-repo',
});
```

---

## Strategy 2: Amazon S3 or Cloudflare R2 hosting

Sync `.diffra/` output directly to an S3 or R2 bucket configured for static website hosting:

```bash
aws s3 sync .diffra/ s3://my-visual-reports-bucket/ --delete
```

---

## Strategy 3: Local report review server

When developing locally or in an offline environment:

```bash
# Serve latest report on http://localhost:9000
diffra serve

# Serve on custom port with specific report file
diffra serve --port 3000 --report .diffra/runs/run-1708701234/report.json
```
