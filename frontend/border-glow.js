/**
 * PLUCK — React Bits <BorderGlow /> Engine (High-Performance Vanilla JS Variant)
 * Optimized with cached card rects, rAF-batched CSS variable writes,
 * touch-device skip, and debounced MutationObserver.
 */
(function initBorderGlowEngine() {
  'use strict';

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

  function parseHSL(hslStr) {
    if (!hslStr) return { h: 268, s: 85, l: 75 };
    const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
    if (!match) return { h: 268, s: 85, l: 75 };
    return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
  }

  function buildGlowVars(glowColor, intensity = 1.0) {
    const { h, s, l } = parseHSL(glowColor);
    const base = `${h}deg ${s}% ${l}%`;
    const opacities = [100, 60, 50, 40, 30, 20, 10];
    const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
    const vars = {};
    for (let i = 0; i < opacities.length; i++) {
      vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
    }
    return vars;
  }

  const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
  const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
  const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

  function buildGradientVars(colors) {
    const vars = {};
    for (let i = 0; i < 7; i++) {
      const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
      vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
    }
    vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
    return vars;
  }

  const DEFAULT_COLORS = ['#c084fc', '#f472b6', '#38bdf8'];
  const DEFAULT_GLOW = '268 85 75';

  const CARD_SELECTOR = [
    '.feat-card',
    '.plan-card',
    '.mockup-box',
    '.snippet-card',
    '.detect-card',
    '.hero-editor',
    '.auth-card',
    '.stat-card',
    '.magic-bento-card',
    '.border-glow-card',
    '.walkthrough-guide-card',
    '.settings-card',
    '.team-card'
  ].join(', ');

  const initializedCards = new WeakSet();
  let rectCacheVersion = 0;
  window.addEventListener('scroll', () => { rectCacheVersion++; }, { passive: true });
  window.addEventListener('resize', () => { rectCacheVersion++; }, { passive: true });

  function setupCard(card) {
    if (!card || initializedCards.has(card)) return;
    initializedCards.add(card);

    if (!card.classList.contains('border-glow-card')) {
      card.classList.add('border-glow-card');
    }

    let edgeLight = card.querySelector(':scope > .edge-light');
    if (!edgeLight) {
      edgeLight = document.createElement('span');
      edgeLight.className = 'edge-light';
      edgeLight.setAttribute('aria-hidden', 'true');
      card.prepend(edgeLight);
    }

    const glowColor = card.dataset.glowColor || DEFAULT_GLOW;
    const colors = card.dataset.colors ? card.dataset.colors.split(',') : DEFAULT_COLORS;
    const sensitivity = parseInt(card.dataset.edgeSensitivity || '25', 10);
    const radius = card.dataset.borderRadius || '6px';

    card.style.setProperty('--border-radius', radius);
    card.style.setProperty('--edge-sensitivity', sensitivity);
    card.style.setProperty('--cone-spread', '25');

    const glowVars = buildGlowVars(glowColor, 1.0);
    for (const [k, v] of Object.entries(glowVars)) {
      card.style.setProperty(k, v);
    }

    const gradVars = buildGradientVars(colors);
    for (const [k, v] of Object.entries(gradVars)) {
      card.style.setProperty(k, v);
    }

    if (prefersReducedMotion || isTouchDevice) return;

    let cachedRect = null;
    let cachedVersion = -1;
    let rafId = 0;
    let lastClientX = 0;
    let lastClientY = 0;

    function getRect() {
      if (!cachedRect || cachedVersion !== rectCacheVersion) {
        cachedRect = card.getBoundingClientRect();
        cachedVersion = rectCacheVersion;
      }
      return cachedRect;
    }

    function flushGlow() {
      rafId = 0;
      const rect = getRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const x = lastClientX - rect.left;
      const y = lastClientY - rect.top;
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.5;
      const dx = x - cx;
      const dy = y - cy;

      let kx = Infinity;
      let ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      let degrees = 0;
      if (dx !== 0 || dy !== 0) {
        degrees = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (degrees < 0) degrees += 360;
      }

      card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(1)}`);
      card.style.setProperty('--cursor-angle', `${degrees.toFixed(1)}deg`);
    }

    card.addEventListener('pointerenter', () => {
      cachedRect = card.getBoundingClientRect();
      cachedVersion = rectCacheVersion;
    }, { passive: true });

    card.addEventListener('pointermove', (e) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(flushGlow);
      }
    }, { passive: true });

    card.addEventListener('pointerleave', () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      cachedRect = null;
      card.style.setProperty('--edge-proximity', '0');
    }, { passive: true });
  }

  function initAllCards() {
    const cards = document.querySelectorAll(CARD_SELECTOR);
    cards.forEach(setupCard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllCards);
  } else {
    initAllCards();
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && node.matches(CARD_SELECTOR)) {
            setupCard(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll(CARD_SELECTOR).forEach(setupCard);
          }
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.initBorderGlow = initAllCards;
})();
