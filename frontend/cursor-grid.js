/**
 * PLUCK — Cursor Grid Background Engine (React Bits Variant)
 * Zero-dependency interactive canvas grid that reacts to cursor proximity,
 * hold-time fading, and click pulse shockwaves.
 */
(function initCursorGrid() {
  'use strict';

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
    color: '#00F2FE',       // Electric Cyan
    radius: 160,
    falloff: 'smooth',
    holdTime: 350,
    fadeDuration: 750,
    lineWidth: 1.2,
    maxOpacity: 0.95,
    fillOpacity: 0.08,      // Subtle glowing fill
    gridOpacity: 0.04,      // Faint ambient lattice
    cellRadius: 4,
    clickPulse: true,
    pulseSpeed: 650
  };

  function mount() {
    let canvas = document.getElementById('cursor-grid-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'cursor-grid-canvas';
      canvas.className = 'cursor-grid-canvas';
      document.body.prepend(canvas);
    }

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cols = 0;
    let rows = 0;
    let offX = 0;
    let offY = 0;
    let alphas = new Float32Array(0);
    let touched = new Float64Array(0);
    let w = 0;
    let h = 0;
    const pulses = [];
    let raf = 0;
    let running = false;
    let lastFrame = performance.now();

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

      wake();
    }

    function cellCenter(i) {
      const cx = offX + (i % cols) * CONFIG.cellSize + CONFIG.cellSize / 2;
      const cy = offY + Math.floor(i / cols) * CONFIG.cellSize + CONFIG.cellSize / 2;
      return [cx, cy];
    }

    function energize(x, y, boost) {
      const r = Math.max(CONFIG.radius, 1);
      const ease = FALLOFF_CURVES[CONFIG.falloff] ?? FALLOFF_CURVES.linear;
      const now = performance.now();

      const minCol = Math.max(0, Math.floor((x - r - offX) / CONFIG.cellSize));
      const maxCol = Math.min(cols - 1, Math.floor((x + r - offX) / CONFIG.cellSize));
      const minRow = Math.max(0, Math.floor((y - r - offY) / CONFIG.cellSize));
      const maxRow = Math.min(rows - 1, Math.floor((y + r - offY) / CONFIG.cellSize));

      for (let cRow = minRow; cRow <= maxRow; cRow++) {
        for (let cCol = minCol; cCol <= maxCol; cCol++) {
          const i = cRow * cols + cCol;
          const [cx, cy] = cellCenter(i);
          const dist = Math.hypot(cx - x, cy - y);
          if (dist > r) continue;

          const level = ease(1 - dist / r) * CONFIG.maxOpacity * (boost ?? 1);
          if (level > alphas[i]) {
            alphas[i] = level;
            touched[i] = now;
          } else if (level > 0) {
            touched[i] = now;
          }
        }
      }
    }

    function draw(now) {
      const dt = Math.min(now - lastFrame, 50);
      lastFrame = now;
      ctx.clearRect(0, 0, w, h);
      const [cr, cg, cb] = hexToRgb(CONFIG.color);

      // 1. Ambient faint static lattice
      if (CONFIG.gridOpacity > 0) {
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${CONFIG.gridOpacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let cCol = 0; cCol <= cols; cCol++) {
          const x = Math.round(offX + cCol * CONFIG.cellSize) + 0.5;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let cRow = 0; cRow <= rows; cRow++) {
          const y = Math.round(offY + cRow * CONFIG.cellSize) + 0.5;
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();
      }

      // 2. Expanding click pulse shockwaves
      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const pulse = pulses[pi];
        const age = (now - pulse.t0) / 1000;
        const ringR = age * CONFIG.pulseSpeed;

        if (ringR > Math.hypot(w, h)) {
          pulses.splice(pi, 1);
          continue;
        }

        const band = CONFIG.cellSize;
        const minCol = Math.max(0, Math.floor((pulse.x - ringR - band - offX) / CONFIG.cellSize));
        const maxCol = Math.min(cols - 1, Math.floor((pulse.x + ringR + band - offX) / CONFIG.cellSize));
        const minRow = Math.max(0, Math.floor((pulse.y - ringR - band - offY) / CONFIG.cellSize));
        const maxRow = Math.min(rows - 1, Math.floor((pulse.y + ringR + band - offY) / CONFIG.cellSize));

        for (let cRow = minRow; cRow <= maxRow; cRow++) {
          for (let cCol = minCol; cCol <= maxCol; cCol++) {
            const i = cRow * cols + cCol;
            const [cx, cy] = cellCenter(i);
            const dist = Math.hypot(cx - pulse.x, cy - pulse.y);
            if (Math.abs(dist - ringR) < band / 2 && CONFIG.maxOpacity > alphas[i]) {
              alphas[i] = CONFIG.maxOpacity;
              touched[i] = now;
            }
          }
        }
      }

      let anyVisible = pulses.length > 0;
      const fadeStep = dt / Math.max(CONFIG.fadeDuration, 16);
      const half = CONFIG.cellSize / 2;

      // 3. Lit cells rendering
      for (let i = 0; i < alphas.length; i++) {
        let a = alphas[i];
        if (a <= 0) continue;

        if (now - touched[i] > CONFIG.holdTime) {
          a = Math.max(0, a - fadeStep);
          alphas[i] = a;
          if (a <= 0) continue;
        }
        anyVisible = true;

        const [cx, cy] = cellCenter(i);
        const gradient = ctx.createRadialGradient(cx, cy, half * 0.1, cx, cy, CONFIG.cellSize);
        gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${a})`);
        gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);

        const x = cx - half + 0.5;
        const y = cy - half + 0.5;
        const s = CONFIG.cellSize - 1;

        ctx.beginPath();
        if (CONFIG.cellRadius > 0) {
          ctx.roundRect(x, y, s, s, CONFIG.cellRadius);
        } else {
          ctx.rect(x, y, s, s);
        }

        if (CONFIG.fillOpacity > 0) {
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a * CONFIG.fillOpacity})`;
          ctx.fill();
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = CONFIG.lineWidth;
        ctx.stroke();
      }

      if (anyVisible) {
        raf = requestAnimationFrame(draw);
      } else {
        running = false;
        if (CONFIG.gridOpacity <= 0) ctx.clearRect(0, 0, w, h);
      }
    }

    function wake() {
      if (running) return;
      running = true;
      lastFrame = performance.now();
      raf = requestAnimationFrame(draw);
    }

    window.addEventListener('pointermove', (e) => {
      energize(e.clientX, e.clientY);
      wake();
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (!CONFIG.clickPulse) return;
      pulses.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
      wake();
    });

    window.addEventListener('resize', rebuild, { passive: true });
    rebuild();

    // Trigger an initial energizing sweep at center
    setTimeout(() => {
      energize(w / 2, h / 2, 0.8);
      wake();
    }, 150);
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
