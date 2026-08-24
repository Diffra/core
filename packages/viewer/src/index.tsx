import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './tokens/theme.css';
import type { TestRunReport } from './types/index.js';

export * from './App.js';
export * from './context/ViewerContext.js';
export * from './types/index.js';

/**
 * Bootstrap function to mount the Diffra Viewer into DOM.
 */
export function initDiffraViewer(
  container?: HTMLElement | null,
  data?: TestRunReport,
): void {
  let manifest = data;

  if (!manifest) {
    const dataScript = document.getElementById('diffra-data');
    if (dataScript?.textContent) {
      try {
        manifest = JSON.parse(dataScript.textContent);
      } catch (err) {
        console.error('[diffra-viewer] Failed to parse report JSON:', err);
      }
    } else {
      const win = window as unknown as {
        __DIFFRA_DATA__?: TestRunReport;
        __SYNDETIC_DATA__?: TestRunReport;
      };
      if (win.__DIFFRA_DATA__) {
        manifest = win.__DIFFRA_DATA__;
      } else if (win.__SYNDETIC_DATA__) {
        manifest = win.__SYNDETIC_DATA__;
      }
    }
  }

  const target =
    container ||
    document.getElementById('root') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'root';
      document.body.appendChild(el);
      return el;
    })();

  if (target && manifest) {
    const root = createRoot(target);
    root.render(
      <React.StrictMode>
        <App manifest={manifest} />
      </React.StrictMode>,
    );
  }
}

// Auto-run bootstrap on DOMContentLoaded or immediate if DOM is already ready
if (typeof document !== 'undefined') {
  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    initDiffraViewer();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      initDiffraViewer();
    });
  }
}
