# Figma design parity and QA

Diffra includes a native Figma driver (`@diffra/core/drivers/figma.ts`) that enables design regression testing and automated Design-to-Code QA directly against the official Figma REST API.

---

## Testing modes

Diffra supports two testing modes for Figma workflows:

1. **Parity mode (`mode: 'parity'`)**: Compares rendered code components against Figma design component frames to catch visual discrepancies during design handoff and implementation QA.
2. **Regression mode (`mode: 'regression'`)**: Compares current Figma design frames against previous versions of the Figma file to detect unintended design token or layout changes in the Figma file itself.

---

## Configuration

Set up Figma configuration in `diffra.config.ts`:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  drivers: {
    driver: 'figma',
    // Figma File Key from file URL: https://www.figma.com/file/<FILE_KEY>/...
    fileKey: process.env.FIGMA_FILE_KEY!,

    // Figma Personal Access Token (can also use process.env.FIGMA_ACCESS_TOKEN)
    personalAccessToken: process.env.FIGMA_ACCESS_TOKEN,

    // Map component names to Figma Node IDs
    components: {
      'Button/Primary': '123:45',
      'Button/Secondary': '123:46',
      'Card/Pricing': '456:78',
      'Modal/Confirmation': '789:10',
    },

    // Export render scale factor (default: 2 for Retina resolution)
    scale: 2,

    // Perceptual sensitivity threshold
    snapshot: {
      diffThreshold: 0.063,
    },
  },
});
```

---

## Authentication and API tokens

Generate a Personal Access Token from Figma:
1. Open Figma and navigate to **Settings** > **Account**.
2. Scroll to **Personal access tokens** and click **Generate new token**.
3. Grant `file_read` permissions.
4. Export the token in your environment:

```bash
export FIGMA_ACCESS_TOKEN="figd_..."
export FIGMA_FILE_KEY="abc123XYZ..."
```

---

## Node ID discovery

To find the Node ID for a component or frame in Figma:
1. Select the layer or frame in Figma.
2. Inspect the browser URL bar: `https://www.figma.com/design/<FILE_KEY>/Title?node-id=123-45`.
3. Replace hyphens with colons: `123-45` becomes `123:45`.

### Automatic frame discovery
If `components` or `nodeIds` are omitted, Diffra automatically scans the Figma document tree via the Figma REST API to discover all top-level `FRAME`, `COMPONENT`, and `COMPONENT_SET` nodes.

---

## Rate limit batching

The Figma REST API enforces rate limits on image exports. Diffra automatically batches node IDs into chunks of 50 frames per request and utilizes internal image caching to prevent rate-limit throttling during large test runs.
