import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './tokens/theme.css';
import type { TestRunReport } from './types/index.js';

export * from './App.js';
export * from './context/ViewerContext.js';
export * from './types/index.js';

/**
 * Clean React 19 bootstrap function to mount the Diffra Viewer into the DOM.
 */
export function initDiffraViewer(
  container?: HTMLElement | null,
  data?: TestRunReport,
): void {
  const target =
    container ||
    document.getElementById('root') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'root';
      document.body.appendChild(el);
      return el;
    })();

  if (target) {
    const root = createRoot(target);
    root.render(
      <React.StrictMode>
        <App initialData={data} />
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
