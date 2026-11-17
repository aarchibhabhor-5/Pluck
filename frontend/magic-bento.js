/**
 * PLUCK — Magic Bento Card Engine (High-Performance Edition)
 * Hover-Only Execution with cached rects, rAF-throttled transforms,
 * DocumentFragment particle batching, and automatic touch/reduced-motion bypass.
 */
(function initMagicBento() {
  'use strict';

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const CONFIG = {
    spotlightRadius: 280,
    particleCount: 6,
    enableTilt: !prefersReducedMotion && !isTouchDevice,
    enableMagnetism: !prefersReducedMotion && !isTouchDevice,
    clickEffect: !prefersReducedMotion,
    glowColor: '6, 182, 212',
  };

  const CARD_SELECTOR = '.snippet-card, .feat-card, .plan-card, .magic-bento-card, .walkthrough-guide-card';
  const initialized = new WeakSet();
  const cardParticleState = new WeakMap();

  let rectVersion = 0;
  window.addEventListener('scroll', () => { rectVersion++; }, { passive: true });
  window.addEventListener('resize', () => { rectVersion++; }, { passive: true });

  function setupMagicBento() {
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    if (!cards.length) return;

    function getOrMakeFxLayer(card) {
      let layer = card.querySelector(':scope > .bento-fx-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'bento-fx-layer';
        const spotlight = document.createElement('div');
        spotlight.className = 'bento-spotlight';
        spotlight.setAttribute('aria-hidden', 'true');
        const borderHighlight = document.createElement('div');
        borderHighlight.className = 'bento-border-highlight';
        borderHighlight.setAttribute('aria-hidden', 'true');
        layer.appendChild(spotlight);
        layer.appendChild(borderHighlight);
        card.prepend(layer);
      }
      return layer;
    }

    cards.forEach(card => {
      if (initialized.has(card)) return;
      initialized.add(card);

      card.style.setProperty('--glow-color', CONFIG.glowColor);
      card.style.setProperty('--glow-radius', `${CONFIG.spotlightRadius}px`);
      card.style.setProperty('--glow-intensity', '0');

      getOrMakeFxLayer(card);

      if (!isTouchDevice && !prefersReducedMotion) {
        let cachedRect = null;
        let cachedVer = -1;
        let rafId = 0;
        let mx = 0;
        let my = 0;

        function getRect() {
          if (!cachedRect || cachedVer !== rectVersion) {
            cachedRect = card.getBoundingClientRect();
            cachedVer = rectVersion;
          }
          return cachedRect;
        }

        function flushHover() {
          rafId = 0;
          const rect = getRect();
          if (!rect || rect.width === 0 || rect.height === 0) return;

          const x = mx - rect.left;
          const y = my - rect.top;
          const centerX = rect.width * 0.5;
          const centerY = rect.height * 0.5;

          const relX = (x / rect.width) * 100;
          const relY = (y / rect.height) * 100;
          card.style.setProperty('--glow-x', `${relX.toFixed(1)}%`);
          card.style.setProperty('--glow-y', `${relY.toFixed(1)}%`);
          card.style.setProperty('--glow-intensity', '1');

          if (CONFIG.enableTilt || CONFIG.enableMagnetism) {
            const rotateX = ((y - centerY) / centerY) * -3.5;
            const rotateY = ((x - centerX) / centerX) * 3.5;
            const magnetX = ((x - centerX) / centerX) * 1.6;
            const magnetY = ((y - centerY) / centerY) * 1.6;

            card.style.transform = `perspective(1200px) translate3d(${magnetX.toFixed(1)}px, calc(-5px + ${magnetY.toFixed(1)}px), 12px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
          }
        }

        card.addEventListener('mouseenter', (e) => {
          cachedRect = card.getBoundingClientRect();
          cachedVer = rectVersion;
          card.classList.add('is-tilting');
          card.style.willChange = 'transform';

          const relX = ((e.clientX - cachedRect.left) / Math.max(1, cachedRect.width)) * 100;
          const relY = ((e.clientY - cachedRect.top) / Math.max(1, cachedRect.height)) * 100;
          card.style.setProperty('--glow-x', `${relX.toFixed(1)}%`);
          card.style.setProperty('--glow-y', `${relY.toFixed(1)}%`);
          card.style.setProperty('--glow-intensity', '1');

          spawnCardParticles(card, cachedRect);
        }, { passive: true });

        card.addEventListener('mousemove', (e) => {
          mx = e.clientX;
          my = e.clientY;
          if (!rafId) {
            rafId = requestAnimationFrame(flushHover);
          }
        }, { passive: true });

        card.addEventListener('mouseleave', () => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
          }
          cachedRect = null;
          card.classList.remove('is-tilting');
          card.style.transform = '';
          card.style.willChange = 'auto';
          card.style.setProperty('--glow-intensity', '0');
          clearCardParticles(card);
        }, { passive: true });
      }

      if (CONFIG.clickEffect) {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button, a, input, select')) return;

          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const maxDist = Math.max(
            Math.hypot(x, y),
            Math.hypot(x - rect.width, y),
            Math.hypot(x, y - rect.height),
            Math.hypot(x - rect.width, y - rect.height)
          );

          const fxLayer = getOrMakeFxLayer(card);
          const ripple = document.createElement('div');
          ripple.className = 'bento-ripple';
          ripple.style.left = `${x.toFixed(1)}px`;
          ripple.style.top = `${y.toFixed(1)}px`;
          const targetScale = Math.max((maxDist * 2.2) / 10, 8);

          fxLayer.appendChild(ripple);

          requestAnimationFrame(() => {
            ripple.style.transform = `scale(${targetScale.toFixed(1)})`;
            ripple.classList.add('active');
          });

          setTimeout(() => {
            ripple.remove();
          }, 600);
        });
      }
    });

    function spawnCardParticles(card, rect) {
      clearCardParticles(card);

      const fxLayer = getOrMakeFxLayer(card);
      const cardW = rect ? rect.width : card.offsetWidth;
      const cardH = rect ? rect.height : card.offsetHeight;
      if (cardW < 40 || cardH < 40) return;

      const frag = document.createDocumentFragment();
      const particles = [];
      const padding = 24;
      const availableW = Math.max(cardW - padding * 2, 20);
      const availableH = Math.max(cardH - padding * 2, 20);

      for (let i = 0; i < CONFIG.particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'bento-particle';

        const startX = Math.random() * availableW + padding;
        const startY = Math.random() * availableH + padding;

        p.style.left = `${startX.toFixed(1)}px`;
        p.style.top = `${startY.toFixed(1)}px`;
        p.style.setProperty('--dx', `${((Math.random() - 0.5) * 16).toFixed(1)}px`);
        p.style.setProperty('--dy', `${((Math.random() - 0.5) * 16).toFixed(1)}px`);
        p.style.setProperty('--dx2', `${((Math.random() - 0.5) * 16).toFixed(1)}px`);
        p.style.setProperty('--dy2', `${((Math.random() - 0.5) * 16).toFixed(1)}px`);
        p.style.setProperty('--duration', `${(4.5 + Math.random() * 2.5).toFixed(2)}s`);
        p.style.setProperty('--delay', `${(Math.random() * 1.1).toFixed(2)}s`);

        frag.appendChild(p);
        particles.push(p);
      }

      fxLayer.appendChild(frag);

      requestAnimationFrame(() => {
        for (let i = 0; i < particles.length; i++) {
          particles[i].classList.add('active');
        }
      });

      cardParticleState.set(card, particles);
    }

    function clearCardParticles(card) {
      const particles = cardParticleState.get(card);
      if (particles) {
        particles.forEach(p => {
          p.classList.remove('active');
          p.style.opacity = '0';
          setTimeout(() => p.remove(), 220);
        });
        cardParticleState.delete(card);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMagicBento);
  } else {
    setupMagicBento();
  }

  window.PluckMagicBento = {
    init: setupMagicBento,
  };
})();
