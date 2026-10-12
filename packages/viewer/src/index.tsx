import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App.js';
import './tokens/theme.css';
import type { TestRunReport } from './types/index.js';

export * from './App.js';
export * from './context/ViewerContext.js';
export * from './types/index.js';

const BaseElement: { new (): HTMLElement } =
  typeof HTMLElement !== 'undefined'
    ? HTMLElement
    : (class {} as unknown as { new (): HTMLElement });

/**
 * Standard Web Component for the Diffra Review UI with Shadow DOM encapsulation.
 */
export class DiffraViewer extends BaseElement {
  private _root: Root | null = null;
  private _shadow: ShadowRoot | null = null;
  private _mountContainer: HTMLDivElement | null = null;
  private _reportUrlProp?: string;
  private _reportDataProp?: TestRunReport;

  static get observedAttributes(): string[] {
    return ['report-url', 'data-report-url', 'report-data', 'data-report'];
  }

  constructor() {
    super();
    if (typeof this.attachShadow === 'function') {
      this._shadow = this.attachShadow({ mode: 'open' });
      this._mountContainer = document.createElement('div');
      this._mountContainer.className = 'diffra-viewer-root';
      this._mountContainer.style.width = '100%';
      this._mountContainer.style.height = '100%';
      if (this._shadow && this._mountContainer) {
        this._shadow.appendChild(this._mountContainer);
      }
    }
  }

  connectedCallback(): void {
    this._render();
  }

  disconnectedCallback(): void {
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }

  attributeChangedCallback(
    _name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (oldValue !== newValue) {
      this._render();
    }
  }

  get reportUrl(): string | undefined {
    if (this._reportUrlProp) return this._reportUrlProp;
    if (typeof this.getAttribute === 'function') {
      return (
        this.getAttribute('report-url') ||
        this.getAttribute('data-report-url') ||
        undefined
      );
    }
    return undefined;
  }

  set reportUrl(val: string | undefined) {
    this._reportUrlProp = val;
    this._render();
  }

  get reportData(): TestRunReport | undefined {
    if (this._reportDataProp) return this._reportDataProp;
    if (typeof this.getAttribute === 'function') {
      const attrData =
        this.getAttribute('report-data') || this.getAttribute('data-report');
      if (attrData) {
        try {
          return JSON.parse(attrData) as TestRunReport;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  set reportData(val: TestRunReport | undefined) {
    this._reportDataProp = val;
    this._render();
  }

  get manifest(): TestRunReport | undefined {
    return this.reportData;
  }

  set manifest(val: TestRunReport | undefined) {
    this.reportData = val;
  }

  private _render(): void {
    const target =
      this._mountContainer ||
      (typeof this.appendChild === 'function' ? this : null);
    if (!target) return;

    if (!this._root) {
      this._root = createRoot(target as HTMLElement);
    }

    const reportUrl = this.reportUrl;
    const reportData = this.reportData;

    this._root.render(
      <React.StrictMode>
        <App
          initialData={reportData}
          manifest={reportData}
          reportUrl={reportUrl}
        />
      </React.StrictMode>,
    );
  }
}

// Register custom element on global registry
if (typeof customElements !== 'undefined') {
  if (!customElements.get('diffra-viewer')) {
    customElements.define(
      'diffra-viewer',
      DiffraViewer as unknown as CustomElementConstructor,
    );
  }
}

/**
 * Clean React 19 bootstrap function to mount the Diffra Viewer into the DOM.
 * Retained for backwards compatibility.
 */
export function initDiffraViewer(
  container?: HTMLElement | null,
  data?: TestRunReport,
): void {
  const target =
    container ||
    (typeof document !== 'undefined'
      ? document.getElementById('root')
      : null) ||
    (() => {
      if (typeof document === 'undefined') return null;
      const el = document.createElement('div');
      el.id = 'root';
      document.body.appendChild(el);
      return el;
    })();

  if (target) {
    const root = createRoot(target);
    root.render(
      <React.StrictMode>
        <App initialData={data} manifest={data} />
      </React.StrictMode>,
    );
  }
}

// Auto-run bootstrap on DOMContentLoaded or immediate if DOM is already ready
if (typeof document !== 'undefined') {
  const mountIfNeeded = () => {
    // Only auto-mount to #root if no <diffra-viewer> custom element tag is present
    if (
      !document.querySelector('diffra-viewer') &&
      document.getElementById('root')
    ) {
      initDiffraViewer();
    }
  };

  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    mountIfNeeded();
  } else {
    document.addEventListener('DOMContentLoaded', mountIfNeeded);
  }
}
