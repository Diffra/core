# Parallel CI sharding and report merger

For large design systems or extensive web applications with hundreds of pages and viewports, Diffra supports deterministic test matrix sharding across parallel CI runner workers.

---

## How sharding works

Diffra slices the complete task matrix (targets $\times$ viewports $\times$ projects) into $N$ equal partitions using index modulo arithmetic:

```bash
# Slices task i where: i % total === (index - 1)
diffra test --shard 1/4 --output-dir .diffra/shards/1
diffra test --shard 2/4 --output-dir .diffra/shards/2
diffra test --shard 3/4 --output-dir .diffra/shards/3
diffra test --shard 4/4 --output-dir .diffra/shards/4
```

---

## Merging shard reports (`diffra merge-reports`)

Once all shard jobs complete, the `diffra merge-reports` command aggregates multiple partial shard report directories into a single unified `report.json` manifest:

```bash
diffra merge-reports .diffra/shards/1 .diffra/shards/2 .diffra/shards/3 .diffra/shards/4 --output-dir .diffra
```

---

## Complete GitHub Actions matrix example

```yaml
name: Sharded Visual Tests

on:
  pull_request:
    branches: [main]

jobs:
  test-shards:
    name: Shard ${{ matrix.shard }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: ['1/4', '2/4', '3/4', '4/4']
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run visual test shard
        run: |
          SHARD_NUM=$(echo "${{ matrix.shard }}" | cut -d'/' -f1)
          pnpm diffra test --shard ${{ matrix.shard }} --output-dir .diffra/shards/$SHARD_NUM --pass-on-changes

      - name: Upload shard artifacts
        uses: actions/upload-artifact@v4
        with:
          name: diffra-shard-${{ strategy.job-index }}
          path: .diffra/shards/
          retention-days: 1

  merge-and-report:
    name: Merge Reports & Post PR Summary
    needs: test-shards
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      statuses: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Download all shard artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: diffra-shard-*
          path: .diffra/shards-downloaded
          merge-multiple: true

      - name: Merge shard reports
        run: |
          pnpm diffra merge-reports .diffra/shards-downloaded/* --output-dir .diffra
```
