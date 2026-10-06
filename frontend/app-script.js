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
    ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
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

// ── 5. React Bits Dock Magnification Engine for Primary Buttons ──
(function initDockButtons() {
  const buttons = document.querySelectorAll('.btn-solid-pixel, .btn-outline-pixel, .topbar-actions a, .topbar-actions button');
  if (!buttons.length) return;

  const DISTANCE = 140;
  const MAX_SCALE = 1.10;
  const STIFFNESS = 0.22;
  const DAMPING = 0.72;

  const buttonStates = Array.from(buttons).map(btn => ({
    el: btn,
    scale: 1,
    targetScale: 1,
    transX: 0,
    targetTransX: 0,
    transY: 0,
    targetTransY: 0,
    vx: 0,
    vy: 0,
    vs: 0,
    isHovered: false
  }));

  let isTicking = false;
  let mouse = { x: -9999, y: -9999 };

  function update() {
    let active = false;

    buttonStates.forEach(b => {
      if (b.isHovered) {
        b.targetScale = MAX_SCALE;
        b.targetTransX = 0;
        b.targetTransY = -2;
      } else {
        const rect = b.el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = mouse.x - centerX;
        const dy = mouse.y - centerY;
        const dist = Math.hypot(dx, dy);

        if (dist < DISTANCE) {
          const norm = (1 + Math.cos((dist / DISTANCE) * Math.PI)) / 2;
          b.targetScale = 1 + (MAX_SCALE - 1) * norm;
          b.targetTransX = (dx / DISTANCE) * 4 * norm;
          b.targetTransY = (dy / DISTANCE) * 4 * norm;
        } else {
          b.targetScale = 1;
          b.targetTransX = 0;
          b.targetTransY = 0;
        }
      }

      const forceS = (b.targetScale - b.scale) * STIFFNESS;
      b.vs = (b.vs + forceS) * DAMPING;
      b.scale += b.vs;

      const forceX = (b.targetTransX - b.transX) * STIFFNESS;
      b.vx = (b.vx + forceX) * DAMPING;
      b.transX += b.vx;

      const forceY = (b.targetTransY - b.transY) * STIFFNESS;
      b.vy = (b.vy + forceY) * DAMPING;
      b.transY += b.vy;

      if (
        Math.abs(b.scale - 1) > 0.002 ||
        Math.abs(b.transX) > 0.05 ||
        Math.abs(b.transY) > 0.05 ||
        Math.abs(b.vs) > 0.001
      ) {
        b.el.style.transform = `scale(${b.scale.toFixed(3)}) translate(${b.transX.toFixed(1)}px, ${b.transY.toFixed(1)}px)`;
        active = true;
      } else {
        b.el.style.transform = '';
      }
    });

    if (active) {
      requestAnimationFrame(update);
    } else {
      isTicking = false;
    }
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  buttonStates.forEach(b => {
    b.el.addEventListener('mouseenter', () => { b.isHovered = true; });
    b.el.addEventListener('mouseleave', () => { b.isHovered = false; });
  });
})();

