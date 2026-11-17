/**
 * PLUCK — Cursor Grid Background Engine (High-Performance Edition)
 * Zero-dependency interactive canvas grid that reacts ONLY to cursor hover proximity.
 * Optimized with offscreen lattice caching, active-cell tracking, rAF throttling,
 * visibility pausing, and zero per-frame gradient allocations.
 */
(function initCursorGrid() {
  'use strict';

  if (window.__pluckCursorGridInitialized) return;
  window.__pluckCursorGridInitialized = true;

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const FALLOFF_CURVES = {
    linear: t => t,
    smooth: t => t * t * (3 - 2 * t),
    sharp: t => t * t * t
  };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(v.slice(0, 6), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  const CONFIG = {
    cellSize: 64,
    color: '#00F2FE',
    radius: 160,
    falloff: 'smooth',
    holdTime: 420,
    fadeDuration: 950,
    lineWidth: 1.2,
    maxOpacity: 0.78,
    fillOpacity: 0.08,
    gridOpacity: 0.04,
    cellRadius: 4,
    clickPulse: false
  };

  function mount() {
    let canvas = document.getElementById('cursor-grid-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'cursor-grid-canvas';
      canvas.className = 'cursor-grid-canvas';
      document.body.prepend(canvas);
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Offscreen cache for static lattice so we don't stroke 60+ lines every frame
    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d', { alpha: true });

    const [cr, cg, cb] = hexToRgb(CONFIG.color);
    const rgbPrefix = `rgba(${cr}, ${cg}, ${cb}, `;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let cols = 0;
    let rows = 0;
    let offX = 0;
    let offY = 0;
    let alphas = new Float32Array(0);
    let touched = new Float64Array(0);
    const activeCells = new Set();
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let lastFrame = performance.now();
    let pendingPointer = null;
    let resizeTimer = null;

    function drawStaticLattice() {
      bgCanvas.width = canvas.width;
      bgCanvas.height = canvas.height;
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgCtx.clearRect(0, 0, w, h);

      if (CONFIG.gridOpacity > 0) {
        bgCtx.strokeStyle = `${rgbPrefix}${CONFIG.gridOpacity})`;
        bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        for (let cCol = 0; cCol <= cols; cCol++) {
          const x = Math.round(offX + cCol * CONFIG.cellSize) + 0.5;
          bgCtx.moveTo(x, 0);
          bgCtx.lineTo(x, h);
        }
        for (let cRow = 0; cRow <= rows; cRow++) {
          const y = Math.round(offY + cRow * CONFIG.cellSize) + 0.5;
          bgCtx.moveTo(0, y);
          bgCtx.lineTo(w, y);
        }
        bgCtx.stroke();
      }
    }

    function blitStaticLattice() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (CONFIG.gridOpacity > 0 && bgCanvas.width > 0 && bgCanvas.height > 0) {
        ctx.drawImage(bgCanvas, 0, 0);
      }
      ctx.restore();
    }

    function rebuild() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(w / CONFIG.cellSize) + 1;
      rows = Math.ceil(h / CONFIG.cellSize) + 1;
      offX = (w - cols * CONFIG.cellSize) / 2;
      offY = (h - rows * CONFIG.cellSize) / 2;

      alphas = new Float32Array(cols * rows);
      touched = new Float64Array(cols * rows);
      activeCells.clear();

      drawStaticLattice();
      blitStaticLattice();
    }

    function energize(x, y, now) {
      const r = Math.max(CONFIG.radius, 1);
      const rSq = r * r;
      const ease = FALLOFF_CURVES[CONFIG.falloff] || FALLOFF_CURVES.linear;
      const cs = CONFIG.cellSize;
      const half = cs * 0.5;

      const minCol = Math.max(0, Math.floor((x - r - offX) / cs));
      const maxCol = Math.min(cols - 1, Math.floor((x + r - offX) / cs));
      const minRow = Math.max(0, Math.floor((y - r - offY) / cs));
      const maxRow = Math.min(rows - 1, Math.floor((y + r - offY) / cs));

      for (let cRow = minRow; cRow <= maxRow; cRow++) {
        const cy = offY + cRow * cs + half;
        const dy = cy - y;
        const dySq = dy * dy;
        for (let cCol = minCol; cCol <= maxCol; cCol++) {
          const cx = offX + cCol * cs + half;
          const dx = cx - x;
          const distSq = dx * dx + dySq;
          if (distSq > rSq) continue;

          const dist = Math.sqrt(distSq);
          const i = cRow * cols + cCol;
          const level = ease(1 - dist / r) * CONFIG.maxOpacity;
          if (level > alphas[i]) {
            alphas[i] = level;
            touched[i] = now;
            activeCells.add(i);
          } else if (level > 0) {
            touched[i] = now;
            activeCells.add(i);
          }
        }
      }
    }

    function draw(now) {
      raf = 0;
      if (document.hidden) {
        running = false;
        return;
      }

      const dt = Math.min(now - lastFrame, 50);
      lastFrame = now;

      if (pendingPointer) {
        energize(pendingPointer.x, pendingPointer.y, now);
        pendingPointer = null;
      }

      blitStaticLattice();

      const fadeStep = dt / Math.max(CONFIG.fadeDuration, 16);
      const cs = CONFIG.cellSize;
      const s = cs - 1;
      const rad = CONFIG.cellRadius;
      const hasRoundRect = rad > 0 && typeof ctx.roundRect === 'function';

      ctx.lineWidth = CONFIG.lineWidth;

      activeCells.forEach(i => {
        let a = alphas[i];
        if (now - touched[i] > CONFIG.holdTime) {
          a = Math.max(0, a - fadeStep);
          alphas[i] = a;
        }
        if (a <= 0.005) {
          alphas[i] = 0;
          activeCells.delete(i);
          return;
        }

        const cCol = i % cols;
        const cRow = (i - cCol) / cols;
        const x = offX + cCol * cs + 0.5;
        const y = offY + cRow * cs + 0.5;

        ctx.beginPath();
        if (hasRoundRect) {
          ctx.roundRect(x, y, s, s, rad);
        } else {
          ctx.rect(x, y, s, s);
        }

        if (CONFIG.fillOpacity > 0) {
          ctx.fillStyle = `${rgbPrefix}${(a * CONFIG.fillOpacity).toFixed(3)})`;
          ctx.fill();
        }

        ctx.strokeStyle = `${rgbPrefix}${(a * 0.72).toFixed(3)})`;
        ctx.stroke();
      });

      if (activeCells.size > 0 || pendingPointer) {
        raf = requestAnimationFrame(draw);
      } else {
        running = false;
      }
    }

    function wake() {
      if (running || document.hidden) return;
      running = true;
      lastFrame = performance.now();
      raf = requestAnimationFrame(draw);
    }

    rebuild();

    // Only animate hover cells on desktop fine-pointer devices with motion enabled
    if (!prefersReducedMotion && !isTouchDevice) {
      window.addEventListener('pointermove', (e) => {
        pendingPointer = { x: e.clientX, y: e.clientY };
        wake();
      }, { passive: true });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        running = false;
      } else if (!document.hidden && activeCells.size > 0) {
        wake();
      }
    });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 120);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.PluckCursorGrid = {
    init: mount,
    config: CONFIG
  };
})();
