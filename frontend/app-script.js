/* =====================================================
   PLUCK — Application Shared Script
   Matrix Rain, Cmd+K Palette, Toasts & Common Utilities
   ===================================================== */

// ── 1. Matrix Rain Background ──────────────────────────
(function initMatrix() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const CHARS = '0123456789ABCDEF{}()<>=+*!?;:_/~$#@';
  const FONT_SIZE = 14;
  let cols = Math.floor(canvas.width / FONT_SIZE);
  let drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50));

  function draw() {
    ctx.fillStyle = 'rgba(14, 5, 40, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${FONT_SIZE}px "Space Mono", monospace`;
    for (let i = 0; i < drops.length; i++) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      ctx.fillStyle = Math.random() < 0.05 ? '#f472b6' : '#7c3aed';
      ctx.fillText(ch, i * FONT_SIZE, drops[i] * FONT_SIZE);

      if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  setInterval(draw, 50);
})();

// ── 2. Toast System ───────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'pluck-toast';
  const icon = type === 'success' ? '⚡' : type === 'error' ? '⚠️' : '✨';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

// ── 3. Global Cmd+K Command Palette ────────────────────
(function initCmdK() {
  const overlay = document.getElementById('cmdk-modal');
  const input = document.getElementById('cmdk-input');
  const resultsContainer = document.getElementById('cmdk-results');

  const SAMPLE_ITEMS = [
    { title: 'useDebounce Hook', lang: 'TypeScript', pkg: 'react ^18', path: 'snippet.html?id=use-debounce' },
    { title: 'JWT Sign & Verify Middleware', lang: 'TypeScript', pkg: 'jsonwebtoken', path: 'snippet.html?id=jwt-auth' },
    { title: 'S3 Presigned URL Uploader', lang: 'Python', pkg: 'boto3', path: 'snippet.html?id=s3-upload' },
    { title: 'Sliding Window Rate Limiter', lang: 'TypeScript', pkg: 'ioredis', path: 'snippet.html?id=redis-ratelimit' },
    { title: 'Prisma Soft Delete Extension', lang: 'TypeScript', pkg: '@prisma/client', path: 'snippet.html?id=prisma-soft-delete' },
    { title: 'FastAPI CORS & Error Handler', lang: 'Python', pkg: 'fastapi', path: 'snippet.html?id=fastapi-cors' },
    { title: '+ Create New Snippet', lang: 'Action', pkg: 'Studio', path: 'studio.html' },
    { title: 'Open Team Workspace (Acme Core Eng)', lang: 'Action', pkg: 'Teams', path: 'team.html' },
    { title: 'API Access Tokens & MCP Config', lang: 'Action', pkg: 'Settings', path: 'settings.html' },
    { title: 'Pluck Landing Page', lang: 'Action', pkg: 'Home', path: 'index.html' }
  ];

  function openPalette() {
    if (!overlay) return;
    overlay.classList.add('open');
    if (input) {
      input.value = '';
      input.focus();
      renderResults(SAMPLE_ITEMS);
    }
  }

  function closePalette() {
    if (!overlay) return;
    overlay.classList.remove('open');
  }

  function renderResults(items) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    if (items.length === 0) {
      resultsContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--muted); font-size: 12px;">No snippets match this query</div>`;
      return;
    }

    items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `cmdk-item ${index === 0 ? 'selected' : ''}`;
      el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: var(--cyan); font-size: 11px;">[${item.lang}]</span>
          <span style="font-weight: 700;">${item.title}</span>
          <span class="dep-chip" style="font-size: 9px;">${item.pkg}</span>
        </div>
        <span style="font-size: 10px; color: var(--muted);">↵ Open</span>
      `;
      el.addEventListener('click', () => {
        window.location.href = item.path;
      });
      resultsContainer.appendChild(el);
    });
  }

  // Global Keydown
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay && overlay.classList.contains('open')) {
        closePalette();
      } else {
        openPalette();
      }
    } else if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
      closePalette();
    }
  });

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePalette();
    });
  }

  // Search input filtering
  if (input) {
    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = SAMPLE_ITEMS.filter(it => 
        it.title.toLowerCase().includes(q) || 
        it.lang.toLowerCase().includes(q) || 
        it.pkg.toLowerCase().includes(q)
      );
      renderResults(filtered);
    });
  }

  // Trigger button clicks
  document.querySelectorAll('.js-open-cmdk').forEach(btn => {
    btn.addEventListener('click', openPalette);
  });
})();

// ── 4. Quick Copy Helper ───────────────────────────────
function copySnippetText(text, label = 'Code copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(label, 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}
