/**
 * PLUCK — Magic Bento Card Engine (React Bits Variant)
 * Hover-Only Execution:
 * Runs concurrently with BorderGlow without conflict.
 * Effects:
 * 1. Ambient Electric Cyan Spotlight following cursor inside card
 * 2. Cyan Border Highlight tracing cursor along card perimeter
 * 3. Twinkling & Floating Star Particles drifting inside card
 * 4. 3D Tilt & Magnetic cursor perspective
 * 5. Click Ripple Effect
 * All effects are strictly contained inside card boundaries.
 */
(function initMagicBento() {
  'use strict';

  const CONFIG = {
    spotlightRadius: 280,
    particleCount: 10,
    enableTilt: true,
    enableMagnetism: true,
    clickEffect: true,
    glowColor: '6, 182, 212', // Electric Cyan
  };

  const CARD_SELECTOR = '.snippet-card, .feat-card, .plan-card, .magic-bento-card, .walkthrough-guide-card';

  function setupMagicBento() {
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    if (!cards.length) return;

    // Track particle states per card
    const cardParticleState = new WeakMap();

    function getOrMakeFxLayer(card) {
      let layer = card.querySelector(':scope > .bento-fx-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'bento-fx-layer';
        card.prepend(layer);
      }
      if (!layer.querySelector('.bento-spotlight')) {
        const spotlight = document.createElement('div');
        spotlight.className = 'bento-spotlight';
        spotlight.setAttribute('aria-hidden', 'true');
        layer.appendChild(spotlight);
      }
      if (!layer.querySelector('.bento-border-highlight')) {
        const borderHighlight = document.createElement('div');
        borderHighlight.className = 'bento-border-highlight';
        borderHighlight.setAttribute('aria-hidden', 'true');
        layer.appendChild(borderHighlight);
      }
      return layer;
    }

    cards.forEach(card => {
      card.style.setProperty('--glow-color', CONFIG.glowColor);
      card.style.setProperty('--glow-radius', `${CONFIG.spotlightRadius}px`);
      card.style.setProperty('--glow-intensity', '0');

      // Pre-initialize isolated FX layer & ambient elements
      getOrMakeFxLayer(card);

      // ── Mousemove: ONLY active while cursor is directly inside this card ──
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Dynamic border glow & spotlight follows cursor position inside this card
        const relX = (x / rect.width) * 100;
        const relY = (y / rect.height) * 100;
        card.style.setProperty('--glow-x', `${relX.toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${relY.toFixed(1)}%`);
        card.style.setProperty('--glow-intensity', '1');

        // 3D Tilt & subtle cursor magnetism combined with card elevation
        if (CONFIG.enableTilt || CONFIG.enableMagnetism) {
          const rotateX = ((y - centerY) / centerY) * -5;
          const rotateY = ((x - centerX) / centerX) * 5;
          const magnetX = ((x - centerX) / centerX) * 2;
          const magnetY = ((y - centerY) / centerY) * 2;

          card.style.transform = `perspective(1200px) translate3d(${magnetX.toFixed(1)}px, calc(-7px + ${magnetY.toFixed(1)}px), 16px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
        }
      });

      // ── Mouseenter: Start glow & floating particles on THIS card only ──
      card.addEventListener('mouseenter', (e) => {
        const rect = card.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * 100;
        const relY = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--glow-x', `${relX.toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${relY.toFixed(1)}%`);
        card.style.setProperty('--glow-intensity', '1');

        spawnCardParticles(card);
      });

      // ── Mouseleave: Immediately turn off all effects on THIS card ──
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.setProperty('--glow-intensity', '0');
        clearCardParticles(card);
      });

      // ── Click Ripple Glow Effect strictly inside this card ──
      if (CONFIG.clickEffect) {
        card.addEventListener('click', (e) => {
          // Avoid creating multiple ripples if clicking an interactive inner button
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
          // Anchor the dot exactly at click coordinates without affecting document flow
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
          }, 650);
        });
      }
    });

    // ── Floating & Twinkling Star Particle System strictly inside this card ──
    function spawnCardParticles(card) {
      clearCardParticles(card);

      const fxLayer = getOrMakeFxLayer(card);
      const rect = card.getBoundingClientRect();
      const cardW = rect.width;
      const cardH = rect.height;
      if (cardW < 40 || cardH < 40) return;

      const particles = [];
      const padding = 24;
      const availableW = Math.max(cardW - padding * 2, 20);
      const availableH = Math.max(cardH - padding * 2, 20);

      for (let i = 0; i < CONFIG.particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'bento-particle';

        // Keep initial particle position safely away from borders
        const startX = Math.random() * availableW + padding;
        const startY = Math.random() * availableH + padding;

        const dx = ((Math.random() - 0.5) * 16).toFixed(1);
        const dy = ((Math.random() - 0.5) * 16).toFixed(1);
        const dx2 = ((Math.random() - 0.5) * 16).toFixed(1);
        const dy2 = ((Math.random() - 0.5) * 16).toFixed(1);
        const duration = (2.2 + Math.random() * 1.6).toFixed(2);
        const delay = (Math.random() * 0.8).toFixed(2);

        p.style.left = `${startX.toFixed(1)}px`;
        p.style.top = `${startY.toFixed(1)}px`;
        p.style.setProperty('--dx', `${dx}px`);
        p.style.setProperty('--dy', `${dy}px`);
        p.style.setProperty('--dx2', `${dx2}px`);
        p.style.setProperty('--dy2', `${dy2}px`);
        p.style.setProperty('--duration', `${duration}s`);
        p.style.setProperty('--delay', `${delay}s`);

        fxLayer.appendChild(p);
        particles.push(p);

        // Smooth fade-in
        requestAnimationFrame(() => {
          p.classList.add('active');
        });
      }

      cardParticleState.set(card, particles);
    }

    function clearCardParticles(card) {
      const particles = cardParticleState.get(card);
      if (particles) {
        particles.forEach(p => {
          p.classList.remove('active');
          p.style.opacity = '0';
          setTimeout(() => p.remove(), 250);
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
