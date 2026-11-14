# Review bundle

Every run produces a review bundle: a directory that is a complete, static review site. It needs no server and no network, so the same output works when opened from disk, served by `diffra serve`, attached to a workflow run, or published to any static host.

---

## Layout

```
<outputDir>/runs/<runId>/
├── index.html          # The review interface with the report embedded
├── viewer.bundle.js    # The review interface
├── viewer.css
├── report.json         # The same report, for tools and for hosted viewers
└── images/
    └── <sha256>.png    # Candidate, baseline, and diff images
```

`outputDir` is `.diffra` unless `storage.outputDir` says otherwise.

Images are named by content hash, so identical images are stored once. Only targets that need review get images: changed, added, and failed targets. Unchanged targets are listed without images to keep bundles small.

---

## Report image references

Each image in `report.json` has:

| Field | Meaning |
| :--- | :--- |
| `hash` | SHA-256 of the image content. |
| `url` | Path relative to `report.json`, for example `images/3c7f….png`. The review interface only ever loads this field. |
| `path` | Storage-internal location of the image (a file path or an object store URL). Never loaded by the review interface. |

Because `url` is relative, moving or publishing the bundle directory never breaks it.

---

## Review links

The link posted on a pull request depends on where the bundle is published:

1. **Hosted**: if `reportBaseUrl` is set (config, the `reportBaseUrl` action input, or `DIFFRA_REPORT_BASE_URL`), the link is `<reportBaseUrl>/runs/<runId>/`. `reportBaseUrl` is the public URL of the output directory, for example a GitHub Pages site, a public bucket or a CDN.
2. **Workflow artifact**: in GitHub Actions without a hosted location, the action uploads the bundle as the `diffra-report` artifact and links to it. Download, unzip, and open `index.html`. If the upload is disabled or fails, the link is the workflow run page.
3. **Local**: otherwise the link is the `file://` path of `index.html`.

---

## Baseline storage is separate

Storage adapters hold baselines and the run records that approval reads back. The review bundle is always written to the local output directory, independent of the storage backend, so reviewing never requires read access to a private bucket.

---

## Serving and embedding

* `diffra serve` serves a bundle directory (the latest run by default).
* A hosted copy of the review interface can load any published `report.json` with `?report=<url>`. Relative image URLs resolve against the report's URL.
