# Interactive review user interface

The `@diffra/viewer` package provides a clean, spacious Scandinavian minimalist review interface embedded in every generated HTML report and standalone deployment.

---

## Directory layout and deterministic URLs

Diffra organizes reports into a deterministic directory structure that enables permanent historical records and cross-branch navigation:

```
.diffra/ (or https://<org>.github.io/<repo>/)
├── runs/
│   └── run-1708701234/
│       ├── index.html          # Standalone bundled report for this specific run
│       ├── report.json         # Full JSON test manifest
│       ├── candidates/         # Candidate PNG images
│       └── diffs/              # Perceptual diff masks
├── branches/
│   ├── main/
│   │   └── latest/
│   │       ├── index.html      # Latest official baseline report for main
│   │       └── report.json
│   └── feature_redesign/
│       └── latest/
│           ├── index.html      # Latest report for feature branch
│           └── report.json
└── latest/                     # Pointer to the most recent test run
```

### Cross-branch interlinking
Because URLs and relative directory structures are deterministic:
- The viewer header displays `branch (commit) vs baselineBranch (baselineCommit)`.
- Clicking the baseline badge in the viewer header navigates directly to `../../branches/<baselineBranch>/latest/index.html`.
- Clicking the branch name navigates to `../../branches/<branch>/latest/index.html`.

---

## Local server execution

To launch the local review server for the latest test run:

```bash
diffra serve
```

Open `http://localhost:9000` in your web browser.

---

## Inspection modes

The review interface includes six synchronized comparison modes:

### 1. Split view (1)
Presents the baseline and candidate screenshots side-by-side with synchronized zoom and pan controls.

### 2. Swipe slider (2)
Provides an interactive horizontal slider that dynamically clips between the baseline and candidate images, highlighting subtle geometry and padding shifts.

### 3. Onion skin (3)
A continuous opacity crossfade slider from 0% (baseline) to 100% (candidate).

### 4. Diff mask and blink mode (4)
Displays a color-coded highlight mask showing every pixel that exceeded the delta-E threshold. Toggling blink mode alternates between baseline and candidate at 2Hz to catch layout shifts.

### 5. Heatmap (5)
A dynamic thermal heat map colormap (cyan -> amber -> crimson -> magenta) revealing localized hotspots of visual variance.

### 6. Pixel movement diff highlight (6)
A high-contrast diff mode that highlights changed or shifted pixels in vivid neon green against a muted monochrome backdrop.

---

## Additional viewer controls

* **Bounding box overlays**: Highlights clustered regions of visual change with red wireframe rectangles.
* **Component filter and search**: Real-time filtering by component group or status (changed, added, passed).
* **Keyboard shortcuts**: Navigate snapshots and toggle view modes using number keys `1`-`6` and arrow keys.
* **Cross-branch baseline jump**: Header branch indicators linking to the latest baseline branch report.

