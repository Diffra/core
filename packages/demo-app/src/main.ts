import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="header">
    <div class="brand">
      <span>Diffra Web Demo</span>
      <span class="brand-badge">Vite + TS</span>
    </div>
    <nav class="nav">
      <a href="/" class="active">Overview</a>
      <a href="#dashboard">Dashboard</a>
      <a href="#settings">Settings</a>
    </nav>
  </header>

  <main class="main-content">
    <section class="hero">
      <h1>Visual Regression for Modern Web Applications</h1>
      <p>
        Diffra tests your production routes, design tokens, and web applications in complete isolation with zero-config multi-engine browser capture.
      </p>
      <button class="btn-primary" id="trigger-action">Explore Metrics</button>
    </section>

    <section id="dashboard-section">
      <div class="grid">
        <div class="card">
          <h3>Test Execution Speed</h3>
          <div class="metric-value">12.4 ms</div>
          <p>Rust SIMD hardware-accelerated pixel comparison across AVX2 and ARM NEON.</p>
        </div>
        <div class="card">
          <h3>Content Addressing</h3>
          <div class="metric-value">100%</div>
          <p>SHA-256 deduplicated CAS storage with O(1) baseline fast-path match.</p>
        </div>
        <div class="card">
          <h3>Dynamic State</h3>
          <div class="metric-value">Masked</div>
          <p>Native Playwright element masking for real-time dynamic counters.</p>
          <div class="timestamp-badge">Updated: <span id="current-time">${new Date().toISOString()}</span></div>
        </div>
      </div>
    </section>
  </main>
`;

const button = document.getElementById('trigger-action');
if (button) {
  button.addEventListener('click', () => {
    const timeSpan = document.getElementById('current-time');
    if (timeSpan) {
      timeSpan.textContent = new Date().toISOString();
    }
  });
}
