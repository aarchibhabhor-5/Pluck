/* =====================================================
   AnimatedList JavaScript Component (from React Bits)
   Complete, 1:1 Implementation of the React Bits Engine
   ===================================================== */

(function (global) {
  'use strict';

  const THEMES = {
    dark: {
      '--al-frame': 'rgba(38, 35, 46, 0.66)',
      '--al-frame-edge': 'rgba(255, 255, 255, 0.08)',
      '--al-frame-highlight': 'rgba(255, 255, 255, 0.07)',
      '--al-frame-shadow': '0 22px 44px -20px rgba(0, 0, 0, 0.8), 0 6px 16px -8px rgba(0, 0, 0, 0.5)',
      '--al-tile': 'linear-gradient(180deg, #3a3644 0%, #27242f 100%)',
      '--al-tile-edge': 'rgba(255, 255, 255, 0.07)',
      '--al-tile-highlight': 'rgba(255, 255, 255, 0.12)',
      '--al-tile-shadow': '0 4px 10px -4px rgba(0, 0, 0, 0.7)',
      '--al-well': 'rgba(255, 255, 255, 0.08)',
      '--al-ink': '#f4f4f5',
      '--al-muted': 'rgba(244, 244, 245, 0.55)',
      '--al-thumb': 'rgba(255, 255, 255, 0.16)',
      '--al-ring': 'rgba(244, 244, 245, 0.3)',
      '--al-ring-fill': 'rgba(244, 244, 245, 0.05)',
      '--al-hover': 'brightness(1.12)',
      '--al-press': 'brightness(0.85)',
      '--al-active': 'brightness(1.16)'
    },
    light: {
      '--al-frame': 'rgba(240, 240, 243, 0.8)',
      '--al-frame-edge': 'rgba(24, 24, 27, 0.07)',
      '--al-frame-highlight': 'rgba(255, 255, 255, 0.95)',
      '--al-frame-shadow': '0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)',
      '--al-tile': 'linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)',
      '--al-tile-edge': 'rgba(24, 24, 27, 0.08)',
      '--al-tile-highlight': 'rgba(255, 255, 255, 1)',
      '--al-tile-shadow': '0 4px 10px -5px rgba(24, 24, 27, 0.25)',
      '--al-well': 'rgba(24, 24, 27, 0.05)',
      '--al-ink': '#27272a',
      '--al-muted': 'rgba(39, 39, 42, 0.55)',
      '--al-thumb': 'rgba(24, 24, 27, 0.16)',
      '--al-ring': 'rgba(24, 24, 27, 0.28)',
      '--al-ring-fill': 'transparent',
      '--al-hover': 'brightness(0.97)',
      '--al-press': 'brightness(0.92)',
      '--al-active': 'none'
    }
  };

  const GLYPHS = {
    folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.4-.6l-1.4-1.4A2 2 0 0 0 7.9 3.4H4a2 2 0 0 0-2 2v12.6a2 2 0 0 0 2 2h16Z"/></svg>',
    image: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    video: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="15" height="14" x="2" y="5" rx="3"/><path d="m17 9 4-2.5v11L17 15"/></svg>',
    note: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="18" x="4" y="3" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>',
    figma: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5ZM12 2h3.5a3.5 3.5 0 1 1 0 7H12V2ZM12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0ZM5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0ZM5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5Z"/></svg>',
    music: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l8 4v7"/><circle cx="16" cy="13" r="4"/></svg>',
    table: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
    pdf: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-5h1.5a1.5 1.5 0 0 1 0 3z"/></svg>',
    presentation: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="3" rx="2"/><path d="M12 17v4M8 21h8"/></svg>',
    zip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 11h1M11 13h1M10 15h1M11 17h1"/></svg>',
    file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    key: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/></svg>',
    database: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    cpu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/></svg>',
    terminal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    box: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    sparkles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>'
  };

  const DEFAULT_ITEMS = [
    { icon: GLYPHS.folder, title: 'Brand assets', description: '24 files', meta: '2m' },
    { icon: GLYPHS.image, title: 'Launch hero.png', description: '2.4 MB', meta: '18m' },
    { icon: GLYPHS.video, title: 'Product tour.mp4', description: '148 MB', meta: '1h' },
    { icon: GLYPHS.note, title: 'Pricing notes', description: '1,240 words', meta: '3h' },
    { icon: GLYPHS.code, title: 'landing-page.tsx', description: '12 KB', meta: '5h' },
    { icon: GLYPHS.figma, title: 'Onboarding flow', description: '38 frames', meta: '8h' },
    { icon: GLYPHS.music, title: 'Ambient loop.wav', description: '9.1 MB', meta: '1d' },
    { icon: GLYPHS.table, title: 'Q3 forecast', description: '4 sheets', meta: '1d' },
    { icon: GLYPHS.pdf, title: 'Brand guidelines.pdf', description: '6.8 MB', meta: '2d' },
    { icon: GLYPHS.presentation, title: 'Investor update', description: '22 slides', meta: '3d' },
    { icon: GLYPHS.zip, title: 'Icon set.zip', description: '1.2 MB', meta: '4d' },
    { icon: GLYPHS.image, title: 'Moodboard.jpg', description: '3.6 MB', meta: '5d' },
    { icon: GLYPHS.file, title: 'Release notes', description: 'Version 2.4', meta: '1w' },
    { icon: GLYPHS.folder, title: 'Archive', description: '118 files', meta: '2w' },
    { icon: GLYPHS.video, title: 'Teaser cut.mov', description: '86 MB', meta: '3w' }
  ];

  const HIDDEN = {
    pop: { above: 'translate3d(0, -12px, 0) scale(0.8)', below: 'translate3d(0, 12px, 0) scale(0.8)' },
    slide: { above: 'translate3d(0, -28px, 0) scale(0.98)', below: 'translate3d(0, 28px, 0) scale(0.98)' },
    fade: { above: 'translate3d(0, -4px, 0)', below: 'translate3d(0, 4px, 0)' }
  };

  const SPRING =
    'linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)';

  const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);

  const FADE_MASK = (() => {
    const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
    const top = steps.map(t => `rgba(0, 0, 0, ${smootherstep(t).toFixed(3)}) calc(var(--al-fade-top) * ${t})`);
    const bottom = [...steps]
      .reverse()
      .map(t => `rgba(0, 0, 0, ${smootherstep(t).toFixed(3)}) calc(100% - var(--al-fade-bottom) * ${t})`);
    return `linear-gradient(to bottom, ${[...top, ...bottom].join(', ')})`;
  })();

  const size = val => (typeof val === 'number' ? `${val}px` : val);

  let idCounter = 0;

  class AnimatedList {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) return;

      this.options = Object.assign({
        items: DEFAULT_ITEMS,
        onItemSelect: null,
        renderItem: null,
        initialSelectedIndex: -1,
        selectOnHover: true,
        enableArrowNavigation: true,
        loop: false,
        animation: 'pop',
        animateOnce: false,
        stagger: 0.05,
        showGradients: true,
        fadeSize: 56,
        displayScrollbar: true,
        frame: true,
        theme: 'dark',
        accentColor: null,
        radius: 14,
        gap: 8,
        width: 420,
        maxHeight: 440,
        className: '',
        itemClassName: '',
        style: {}
      }, options);

      this.selected = this.options.initialSelectedIndex;
      this.baseId = `al-${++idCounter}`;
      this.itemRefs = [];
      this.boxes = [];
      this.currentMode = null;
      this.entered = false;
      this.engaged = false;
      this.pointer = [0, 0];
      this.raf = 0;
      this.lastTime = 0;
      this.keyboardNav = false;
      this.navigating = false;
      this.motion = { y: 0, h: 0, vy: 0, vh: 0, ty: 0, th: 0, ready: false };
      this.fades = { top: '', bottom: '' };

      this.init();
    }

    init() {
      this.container.innerHTML = '';

      // Root container
      this.root = document.createElement('div');
      this.root.className = `animated-list${this.options.frame ? ' animated-list--framed' : ''} ${this.options.className}`.trim();
      if (this.options.animation !== 'none') {
        this.root.dataset.animated = '';
      }

      this.applyCSSVariables();

      // Viewport
      this.viewport = document.createElement('div');
      this.viewport.className = `animated-list__viewport${this.options.displayScrollbar ? '' : ' animated-list__viewport--bare'}`;
      this.viewport.setAttribute('role', 'listbox');
      this.viewport.tabIndex = 0;
      this.viewport.style.maxHeight = size(this.options.maxHeight);

      if (this.options.showGradients) {
        this.viewport.style.maskImage = FADE_MASK;
        this.viewport.style.webkitMaskImage = FADE_MASK;
      }

      // Track
      this.track = document.createElement('div');
      this.track.className = 'animated-list__track';

      // Selection indicator & ring
      this.indicator = document.createElement('span');
      this.indicator.className = 'animated-list__indicator';
      this.indicator.setAttribute('aria-hidden', 'true');

      this.ring = document.createElement('span');
      this.ring.className = 'animated-list__ring';
      this.indicator.appendChild(this.ring);

      this.viewport.appendChild(this.track);
      this.root.appendChild(this.viewport);

      // Frame rim
      if (this.options.frame) {
        this.frameRim = document.createElement('span');
        this.frameRim.className = 'animated-list__frame-rim';
        this.frameRim.setAttribute('aria-hidden', 'true');
        this.root.appendChild(this.frameRim);
      }

      this.container.appendChild(this.root);

      this.renderItems();
      this.bindEngine();
    }

    applyCSSVariables() {
      const themeConfig = THEMES[this.options.theme] || THEMES.dark;
      Object.entries(themeConfig).forEach(([key, val]) => {
        this.root.style.setProperty(key, val);
      });

      this.root.style.setProperty('--al-radius', `${Math.max(0, this.options.radius)}px`);
      this.root.style.setProperty('--al-gap', `${Math.max(0, this.options.gap)}px`);
      this.root.style.setProperty('--al-width', size(this.options.width));
      this.root.style.setProperty('--al-accent', this.options.accentColor || 'var(--al-ink)');

      if (this.options.accentColor) {
        this.root.style.setProperty('--al-ring', this.options.accentColor);
        this.root.style.setProperty('--al-ring-fill', `color-mix(in srgb, ${this.options.accentColor} 8%, transparent)`);
      }

      if (this.options.style) {
        Object.assign(this.root.style, this.options.style);
      }
    }

    renderItems() {
      this.track.innerHTML = '';
      this.itemRefs = [];

      const items = this.options.items || [];

      items.forEach((item, index) => {
        const entry = (item !== null && typeof item === 'object') ? item : { title: String(item) };
        const isSelected = index === this.selected;

        const el = document.createElement('div');
        el.id = `${this.baseId}-${index}`;
        el.className = `animated-list__item ${this.options.itemClassName}`.trim();
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        el.dataset.index = index;
        if (isSelected) el.dataset.selected = '';

        if (this.options.renderItem) {
          el.innerHTML = this.options.renderItem(item, index, isSelected);
        } else {
          let html = '';
          if (entry.image || entry.icon) {
            html += `<span class="animated-list__lead">${entry.image ? `<img src="${entry.image}" alt="" draggable="false" />` : entry.icon}</span>`;
          }
          html += `<span class="animated-list__text">
            <span class="animated-list__title">${entry.title || ''}</span>
            ${entry.description ? `<span class="animated-list__description">${entry.description}</span>` : ''}
          </span>`;
          if (entry.meta) {
            html += `<span class="animated-list__meta">${entry.meta}</span>`;
          }
          el.innerHTML = html;
        }

        const rim = document.createElement('span');
        rim.className = 'animated-list__rim';
        rim.setAttribute('aria-hidden', 'true');
        el.appendChild(rim);

        // Hover & Click events
        el.addEventListener('pointerenter', () => {
          if (this.options.selectOnHover && !this.navigating) {
            this.setSelected(index);
          }
        });

        el.addEventListener('click', () => {
          this.setSelected(index);
          if (this.options.onItemSelect) {
            this.options.onItemSelect(item, index);
          }
        });

        this.track.appendChild(el);
        this.itemRefs.push(el);
      });

      this.track.appendChild(this.indicator);
    }

    bindEngine() {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const springEase = (CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)'))
        ? SPRING
        : 'cubic-bezier(0.34, 1.4, 0.64, 1)';
      const transition = `transform 620ms ${springEase}, opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease`;

      this.mode = () => {
        const chosen = this.options.animation;
        if (chosen === 'none' || !HIDDEN[chosen]) return 'none';
        return reduced ? 'fade' : chosen;
      };

      this.apply = (element, state) => {
        element.dataset.state = state;
        const pose = (this.currentMode && this.currentMode !== 'none' && state !== 'in')
          ? HIDDEN[this.currentMode][state]
          : '';
        element.style.transform = pose;
        element.style.opacity = pose ? '0' : '';
      };

      this.syncRing = () => {
        const item = this.itemRefs[this.selected];
        if (!item) return;
        const state = item.dataset.state || 'in';
        if (state === this.ring.dataset.state) return;
        this.ring.style.transitionDelay = item.style.transitionDelay;
        this.apply(this.ring, state);
      };

      this.writeIndicator = () => {
        this.indicator.style.transform = `translate3d(0, ${this.motion.y.toFixed(2)}px, 0)`;
        this.indicator.style.height = `${this.motion.h.toFixed(2)}px`;
      };

      this.frame = now => {
        this.raf = 0;
        const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0);
        this.lastTime = now;
        const omega = 30;
        const zeta = 0.78;
        const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
        const h = dt / steps;

        for (let i = 0; i < steps; i++) {
          this.motion.vy += (omega * omega * (this.motion.ty - this.motion.y) - 2 * zeta * omega * this.motion.vy) * h;
          this.motion.vh += (omega * omega * (this.motion.th - this.motion.h) - 2 * zeta * omega * this.motion.vh) * h;
          this.motion.y += this.motion.vy * h;
          this.motion.h += this.motion.vh * h;
        }

        const moving =
          Math.abs(this.motion.ty - this.motion.y) > 0.05 ||
          Math.abs(this.motion.th - this.motion.h) > 0.05 ||
          Math.abs(this.motion.vy) + Math.abs(this.motion.vh) > 0.5;

        if (!moving) {
          this.motion.y = this.motion.ty;
          this.motion.h = this.motion.th;
          this.motion.vy = 0;
          this.motion.vh = 0;
        }

        this.writeIndicator();
        if (moving) this.raf = requestAnimationFrame(t => this.frame(t));
      };

      this.place = snap => {
        const item = this.itemRefs[this.selected];
        if (!item) {
          this.indicator.style.opacity = '0';
          this.motion.ready = false;
          return;
        }

        this.indicator.style.opacity = '1';
        this.motion.ty = item.offsetTop;
        this.motion.th = item.offsetHeight;

        if (snap || reduced || !this.motion.ready) {
          this.motion.y = this.motion.ty;
          this.motion.h = this.motion.th;
          this.motion.vy = 0;
          this.motion.vh = 0;
          this.motion.ready = true;
          this.writeIndicator();
          return;
        }

        if (!this.raf) {
          this.lastTime = performance.now();
          this.raf = requestAnimationFrame(t => this.frame(t));
        }
      };

      this.updateFades = () => {
        const span = Math.max(1, this.options.fadeSize);
        const { scrollTop, scrollHeight, clientHeight } = this.viewport;
        const top = this.options.showGradients ? Math.min(span, Math.max(0, scrollTop)) : 0;
        const bottom = this.options.showGradients ? Math.min(span, Math.max(0, scrollHeight - clientHeight - scrollTop)) : 0;
        const nextTop = `${top.toFixed(1)}px`;
        const nextBottom = `${bottom.toFixed(1)}px`;
        if (nextTop !== this.fades.top) {
          this.fades.top = nextTop;
          this.viewport.style.setProperty('--al-fade-top', nextTop);
        }
        if (nextBottom !== this.fades.bottom) {
          this.fades.bottom = nextBottom;
          this.viewport.style.setProperty('--al-fade-bottom', nextBottom);
        }
      };

      this.measure = () => {
        const offset = this.track.offsetTop;
        this.boxes = this.itemRefs.map(item => (item ? [offset + item.offsetTop, item.offsetHeight] : null));
      };

      this.reveal = entrance => {
        if (!this.entered) return;
        const top = this.viewport.scrollTop;
        const view = this.viewport.clientHeight;
        let order = 0;

        this.itemRefs.forEach((item, index) => {
          const box = this.boxes[index];
          if (!item || !box) return;
          const start = box[0] - top;
          const overlap = Math.min(view, start + box[1]) - Math.max(0, start);
          const hidden =
            this.currentMode !== 'none' &&
            overlap < Math.min(box[1], view) * 0.5 &&
            !(this.options.animateOnce && item.dataset.seen);
          const state = hidden ? (start + box[1] / 2 < view / 2 ? 'above' : 'below') : 'in';

          if (state === item.dataset.state) return;
          const delay = entrance && !hidden ? (order++ * Math.max(0, this.options.stagger)).toFixed(3) : 0;
          item.style.transitionDelay = delay ? `${delay}s, ${delay}s, 0s` : '';
          if (!hidden) item.dataset.seen = 'true';
          this.apply(item, state);
        });

        this.syncRing();
      };

      this.sync = () => {
        const items = this.itemRefs.filter(Boolean);
        const next = this.mode();
        const changed = next !== this.currentMode;
        const restyle = changed ? items : items.filter(item => !item.dataset.state);
        this.currentMode = next;
        if (this.currentMode === 'none') this.entered = true;

        if (restyle.length) {
          const elements = changed ? [...restyle, this.ring] : restyle;
          for (const el of elements) el.style.transition = 'none';
          for (const item of restyle) this.apply(item, this.currentMode === 'none' ? 'in' : item.dataset.state || 'below');
          if (changed) this.apply(this.ring, this.itemRefs[this.selected]?.dataset.state || 'in');
          void this.root.offsetHeight; // Force reflow
          for (const el of elements) el.style.transition = transition;
        }

        this.measure();
        this.reveal(restyle.length > 0);
      };

      this.sync();

      // Intersection Observer entrance gating
      if (typeof IntersectionObserver !== 'undefined') {
        this.gate = new IntersectionObserver((entries, observer) => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect();
          if (this.entered) return;
          this.entered = true;
          this.measure();
          this.reveal(true);
        }, { rootMargin: '0px 0px -10% 0px' });

        if (!this.entered) {
          this.gate.observe(this.root);
        }
      } else {
        this.entered = true;
        this.reveal(true);
      }

      // Resize Observer
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.place(true);
          this.updateFades();
          this.measure();
          this.reveal(false);
        });
        this.resizeObserver.observe(this.viewport);
        this.resizeObserver.observe(this.track);
      }

      // Event Listeners
      this.onScroll = () => {
        this.updateFades();
        this.reveal(false);
      };

      this.onKey = event => {
        if (!this.options.enableArrowNavigation || event.defaultPrevented) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const active = document.activeElement;
        const focused = active === this.viewport;
        const idle = !active || active === document.body || active === document.documentElement;
        if (!focused && !(this.engaged && idle)) return;

        const count = this.options.items.length;
        if (!count) return;
        const index = this.selected;
        let next = null;

        if (event.key === 'ArrowDown') next = index < 0 ? 0 : index + 1;
        else if (event.key === 'ArrowUp') next = index < 0 ? count - 1 : index - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = count - 1;
        else if ((event.key === 'Enter' || (focused && event.key === ' ')) && index >= 0 && index < count) {
          event.preventDefault();
          this.options.onItemSelect?.(this.options.items[index], index);
          return;
        }

        if (next === null) return;
        event.preventDefault();
        next = this.options.loop ? (next + count) % count : Math.min(count - 1, Math.max(0, next));
        this.keyboardNav = true;
        this.navigating = true;
        this.setSelected(next);
      };

      this.onPointerMove = event => {
        const moved = event.clientX !== this.pointer[0] || event.clientY !== this.pointer[1];
        this.pointer = [event.clientX, event.clientY];
        if (!this.navigating || !moved) return;
        this.navigating = false;
        const item = event.target instanceof Element ? event.target.closest('[data-index]') : null;
        if (item && this.root.contains(item) && this.options.selectOnHover) {
          this.setSelected(Number(item.dataset.index));
        }
      };

      this.onEnter = () => { this.engaged = true; };
      this.onLeave = () => { this.engaged = false; };

      this.viewport.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('keydown', this.onKey);
      this.root.addEventListener('pointerenter', this.onEnter);
      this.root.addEventListener('pointerleave', this.onLeave);
      this.root.addEventListener('pointermove', this.onPointerMove);

      this.updateFades();
      this.place(true);
      this.syncRing();
    }

    setSelected(index) {
      if (this.selected === index) return;
      this.selected = index;

      this.itemRefs.forEach((item, i) => {
        if (!item) return;
        const isSelected = i === index;
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) {
          item.dataset.selected = '';
        } else {
          item.removeAttribute('data-selected');
        }
      });

      this.place(false);
      this.syncRing();

      if (this.keyboardNav) {
        this.keyboardNav = false;
        const item = this.itemRefs[this.selected];
        if (item) {
          const top = this.track.offsetTop + item.offsetTop;
          const bottom = top + item.offsetHeight;
          const room = Math.max(0, (this.viewport.clientHeight - item.offsetHeight) / 2);
          const margin = Math.min(this.options.showGradients ? Math.max(12, this.options.fadeSize) : 12, room);
          if (top < this.viewport.scrollTop + margin) {
            this.viewport.scrollTo({ top: Math.max(0, top - margin), behavior: 'smooth' });
          } else if (bottom > this.viewport.scrollTop + this.viewport.clientHeight - margin) {
            this.viewport.scrollTo({ top: bottom - this.viewport.clientHeight + margin, behavior: 'smooth' });
          }
        }
      }
    }

    setItems(newItems) {
      this.options.items = newItems || [];
      this.selected = -1;
      this.renderItems();
      this.sync();
      this.updateFades();
    }

    setAnimation(anim) {
      if (!anim || this.options.animation === anim) return;
      this.options.animation = anim;
      if (anim !== 'none') {
        this.root.dataset.animated = '';
      } else {
        this.root.removeAttribute('data-animated');
      }
      this.sync();
    }

    refresh() {
      this.entered = true;
      this.measure();
      this.reveal(false);
      this.place(true);
      this.updateFades();
    }

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.gate) this.gate.disconnect();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.viewport.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('keydown', this.onKey);
      this.root.removeEventListener('pointerenter', this.onEnter);
      this.root.removeEventListener('pointerleave', this.onLeave);
      this.root.removeEventListener('pointermove', this.onPointerMove);
    }
  }

  AnimatedList.GLYPHS = GLYPHS;
  AnimatedList.THEMES = THEMES;
  AnimatedList.DEFAULT_ITEMS = DEFAULT_ITEMS;
  AnimatedList.landingInstances = {};

  // ── Pluck Landing Page Lists Controller ──
  AnimatedList.initLandingPageLists = function (defaultAnim = 'pop') {
    // 1. Free Plan List
    const freeWrap = document.getElementById('plan-free-list');
    if (freeWrap && !AnimatedList.landingInstances.free) {
      freeWrap.innerHTML = '';
      AnimatedList.landingInstances.free = new AnimatedList(freeWrap, {
        items: [
          { icon: GLYPHS.box, title: 'Up to 100 snippets', description: 'Personal storage & offline cache', meta: '100 cap' },
          { icon: GLYPHS.code, title: 'Semantic search', description: 'Intent-based vector + keyword query', meta: 'Shared' },
          { icon: GLYPHS.terminal, title: 'CLI access via PAT', description: 'Terminal pluck sync & pull', meta: 'v1.4' },
          { icon: GLYPHS.folder, title: '1 personal collection', description: 'Scoped categories & tags', meta: '1 slot' }
        ],
        animation: defaultAnim,
        theme: 'dark',
        accentColor: '#22d3ee',
        radius: 10,
        gap: 6,
        width: '100%',
        frame: false,
        showGradients: false,
        displayScrollbar: false,
        stagger: 0.04
      });
    }

    // 2. Pro Plan List
    const proWrap = document.getElementById('plan-pro-list');
    if (proWrap && !AnimatedList.landingInstances.pro) {
      proWrap.innerHTML = '';
      AnimatedList.landingInstances.pro = new AnimatedList(proWrap, {
        items: [
          { icon: GLYPHS.zap, title: 'Unlimited snippets', description: 'Zero snippet caps or rate throttling', meta: '∞' },
          { icon: GLYPHS.code, title: 'Priority semantic search', description: 'Sub-200ms p95 vector lookup', meta: '<200ms' },
          { icon: GLYPHS.zap, title: 'Developer Preferences', description: 'Custom package managers & editor keymaps', meta: 'Active' },
          { icon: GLYPHS.folder, title: 'Unlimited collections', description: 'Multi-folder tagging & trees', meta: 'Unlimited' },
          { icon: GLYPHS.users, title: 'Team workspace', description: 'Collaborate with up to 5 members', meta: '5 seats' }
        ],
        animation: defaultAnim,
        theme: 'dark',
        accentColor: '#facc15',
        radius: 10,
        gap: 6,
        width: '100%',
        frame: false,
        showGradients: false,
        displayScrollbar: false,
        stagger: 0.04
      });
    }

    // 3. Team Plan List
    const teamWrap = document.getElementById('plan-team-list');
    if (teamWrap && !AnimatedList.landingInstances.team) {
      teamWrap.innerHTML = '';
      AnimatedList.landingInstances.team = new AnimatedList(teamWrap, {
        items: [
          { icon: GLYPHS.zap, title: 'Everything in Pro', description: 'All pro tier capabilities included', meta: 'Included' },
          { icon: GLYPHS.users, title: 'Unlimited team + RBAC', description: 'Admin, editor & viewer permissions', meta: 'Custom' },
          { icon: GLYPHS.cpu, title: 'In-browser sandbox', description: 'Execute JS, TS & Python live in worker', meta: 'Sandbox' },
          { icon: GLYPHS.file, title: 'Advanced activity feed', description: 'Audit logging & snippet version diffs', meta: 'Real-time' },
          { icon: GLYPHS.shield, title: 'Priority MCP quota + SLA', description: 'Enterprise AI bandwidth & support', meta: '99.9%' }
        ],
        animation: defaultAnim,
        theme: 'dark',
        accentColor: '#c084fc',
        radius: 10,
        gap: 6,
        width: '100%',
        frame: false,
        showGradients: false,
        displayScrollbar: false,
        stagger: 0.04
      });
    }

    // 4. Hero Vault Snippet List Explorer
    const heroVaultWrap = document.getElementById('hero-vault-animated-list');
    if (heroVaultWrap && !AnimatedList.landingInstances.heroVault) {
      heroVaultWrap.innerHTML = '';
      const heroSnippets = [
        {
          id: 'use-debounce',
          icon: GLYPHS.code,
          title: 'useDebounce — react ^18',
          description: 'Custom React hook with cleanup & generic type support',
          meta: 'react ^18',
          tags: [
            { text: 'react ^18', cls: 'tag-cyan' },
            { text: 'TypeScript', cls: 'tag-blue' },
            { text: '0 secrets', cls: 'tag-green' },
            { text: '0 env keys', cls: 'tag-yellow' }
          ],
          titleText: 'Pluck detected this <span class="underline-cyan">automatically.</span>',
          code: `// Pluck snippet: useDebounce — react ^18
import { useState, useEffect } from 'react';

export function useDebounce<T>(
  value: T,
  delay: number = 300
): T {
  const [debouncedVal, setVal] =
    useState<T>(value);

  useEffect(() => {
    const t = setTimeout(()
      => setVal(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedVal;
}`,
          lines: 18
        },
        {
          id: 'jwt-verify',
          icon: GLYPHS.shield,
          title: 'jwtVerify — jose ^5.2',
          description: 'Edge-runtime compatible JWT signature verification',
          meta: 'jose ^5.2',
          tags: [
            { text: 'jose ^5.2', cls: 'tag-cyan' },
            { text: 'TypeScript', cls: 'tag-blue' },
            { text: '0 secrets', cls: 'tag-green' },
            { text: 'JWT_SECRET env', cls: 'tag-yellow' }
          ],
          titleText: 'Pluck scanned: <span class="underline-green">zero exposed secrets</span>, 1 env key.',
          code: `// Pluck snippet: jwtVerify — jose ^5.2
import { jwtVerify } from 'jose';

export async function verifyAuthToken(token: string) {
  const secretKey = new TextEncoder().encode(
    process.env.JWT_SECRET || ''
  );
  
  const { payload } = await jwtVerify(token, secretKey, {
    issuer: 'urn:pluck:issuer',
    audience: 'urn:pluck:audience',
  });
  
  return payload;
}`,
          lines: 15
        },
        {
          id: 'rate-limiter',
          icon: GLYPHS.zap,
          title: 'slidingRateLimiter — ioredis ^5.3',
          description: 'Atomic sliding window counter using Redis pipeline',
          meta: 'ioredis ^5.3',
          tags: [
            { text: 'ioredis ^5.3', cls: 'tag-cyan' },
            { text: 'Redis', cls: 'tag-blue' },
            { text: '0 secrets', cls: 'tag-green' },
            { text: 'REDIS_URL env', cls: 'tag-yellow' }
          ],
          titleText: 'Pluck AST detected: <span class="underline-yellow">Redis client</span> with required env.',
          code: `// Pluck snippet: slidingRateLimiter — ioredis
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || '');

export async function checkRateLimit(ip: string, limit = 60) {
  const now = Date.now();
  const windowStart = now - 60000;
  const key = \`ratelimit:\${ip}\`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, String(now));
  pipeline.zcard(key);
  pipeline.expire(key, 60);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;
  return count <= limit;
}`,
          lines: 20
        },
        {
          id: 's3-upload',
          icon: GLYPHS.folder,
          title: 's3UploadMultipart — aws-sdk ^3.5',
          description: 'AWS S3 presigned multipart buffer streaming',
          meta: 'aws-sdk ^3.5',
          tags: [
            { text: '@aws-sdk/client-s3', cls: 'tag-cyan' },
            { text: 'AWS SDK v3', cls: 'tag-blue' },
            { text: '0 secrets', cls: 'tag-green' },
            { text: 'AWS_ACCESS_KEY env', cls: 'tag-yellow' }
          ],
          titleText: 'Pluck AST detected: <span class="underline-cyan">AWS S3 client</span> with zero hardcoded keys.',
          code: `// Pluck snippet: s3UploadMultipart — AWS S3
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export async function uploadToVault(key: string, body: Buffer) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.VAULT_S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'application/octet-stream',
  });
  return await s3.send(cmd);
}`,
          lines: 15
        },
        {
          id: 'retry-backoff',
          icon: GLYPHS.cpu,
          title: 'retryWithBackoff — zero deps',
          description: 'Exponential backoff with full jitter & cancellation',
          meta: 'TypeScript',
          tags: [
            { text: 'Zero Deps', cls: 'tag-green' },
            { text: 'TypeScript', cls: 'tag-blue' },
            { text: '0 secrets', cls: 'tag-green' },
            { text: '0 env keys', cls: 'tag-yellow' }
          ],
          titleText: 'Pluck verified: <span class="underline-pink">100% self-contained</span> utility.',
          code: `// Pluck snippet: retryWithBackoff — TypeScript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 4,
  delayMs = 250
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    const jitter = Math.random() * delayMs;
    await new Promise(r => setTimeout(r, delayMs + jitter));
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
}`,
          lines: 16
        }
      ];

      function updateHeroEditor(snippet) {
        const editorCode = document.querySelector('.hero-editor .editor-code code');
        const editorGutter = document.querySelector('.hero-editor .editor-gutter');
        const detectTitle = document.querySelector('#detect-card .detect-card-title');
        const detectTags = document.querySelector('#detect-card .detect-tags');

        if (editorCode) {
          const highlighted = snippet.code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\b(import|export|from|function|async|await|const|let|var|return|try|catch|throw|new)\b/g, '<span class="kw">$1</span>')
            .replace(/\b(string|number|boolean|void|Promise|Buffer|T)\b/g, '<span class="ty">$1</span>')
            .replace(/(\/\/.+)/g, '<span class="c">$1</span>')
            .replace(/('.*?'|".*?"|`.*?`)/g, '<span class="s">$1</span>');
          editorCode.innerHTML = highlighted;
        }

        if (editorGutter) {
          editorGutter.innerHTML = Array.from({ length: snippet.lines }, (_, i) => `<span>${i + 1}</span>`).join('');
        }

        if (detectTitle) {
          detectTitle.innerHTML = snippet.titleText;
        }

        if (detectTags) {
          detectTags.innerHTML = snippet.tags.map(t => `<span class="detect-tag ${t.cls}">${t.text}</span>`).join('');
        }
      }

      AnimatedList.landingInstances.heroVault = new AnimatedList(heroVaultWrap, {
        items: heroSnippets,
        animation: defaultAnim,
        theme: 'dark',
        accentColor: '#06b6d4',
        radius: 12,
        gap: 8,
        width: '100%',
        maxHeight: 280,
        fadeSize: 40,
        showGradients: true,
        displayScrollbar: true,
        frame: true,
        initialSelectedIndex: 0,
        stagger: 0.04,
        onItemSelect: (item) => {
          updateHeroEditor(item);
        }
      });
    }

    // 5. Walkthrough Chapters AnimatedList
    const wtWrap = document.getElementById('walkthrough-animated-list');
    if (wtWrap && !AnimatedList.landingInstances.walkthrough) {
      wtWrap.innerHTML = '';
      const wtItems = [
        { id: 1, icon: GLYPHS.code, title: 'Step 01: Vault & ⌘K Search', description: 'Intent-based natural language code retrieval', meta: '00:00 - 00:35' },
        { id: 2, icon: GLYPHS.shield, title: 'Step 02: Studio & Secret Redact', description: 'Automatic AST detection & 1-click token redaction', meta: '00:35 - 01:05' },
        { id: 3, icon: GLYPHS.cpu, title: 'Step 03: Variables & Sandbox', description: 'Dynamic runtime params & in-browser WebWorker runner', meta: '01:05 - 01:40' },
        { id: 4, icon: GLYPHS.users, title: 'Step 04: Profile & Preferences', description: 'Custom package managers, keymaps & identity', meta: '01:40 - 02:10' }
      ];

      AnimatedList.landingInstances.walkthrough = new AnimatedList(wtWrap, {
        items: wtItems,
        animation: defaultAnim,
        theme: 'dark',
        accentColor: '#a855f7',
        radius: 12,
        gap: 8,
        width: '100%',
        frame: true,
        showGradients: false,
        displayScrollbar: false,
        initialSelectedIndex: 0,
        stagger: 0.05,
        onItemSelect: (item) => {
          if (typeof window.selectChapter === 'function') {
            window.selectChapter(item.id);
          }
        }
      });
    }

    // 6. Connect Animation Switcher Buttons
    const animButtons = document.querySelectorAll('.anim-pill-btn');
    animButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        animButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const anim = btn.dataset.anim || 'pop';
        Object.values(AnimatedList.landingInstances).forEach(inst => {
          if (inst && typeof inst.setAnimation === 'function') {
            inst.setAnimation(anim);
          }
        });
      });
    });
  };

  // Auto-run when DOM is loaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        AnimatedList.initLandingPageLists();
      });
    } else {
      AnimatedList.initLandingPageLists();
    }
  }

  global.AnimatedList = AnimatedList;
})(window);

