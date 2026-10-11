/**
 * React Bits — Dock Component (Vanilla JS + CSS Variant)
 *
 * Implements macOS-style magnification dock with spring physics,
 * hop/bounce animations, notification badges, active indicator dots,
 * floating tooltips, and interactive context menus.
 */

(function (global) {
  'use strict';

  const SIDES = ['bottom', 'top', 'left', 'right'];
  const EDGE = 12;
  const HOP = 0.4;
  const HOP_TIME = 0.38;
  const HOLD_TIME = 450;
  const TAIL = 9;
  const TAIL_HALF = 9;
  const MENU_RADIUS = 10;
  const MENU_GAP = 8;
  const MARGIN = 8;
  const POP = 'cubic-bezier(0.2, 1.25, 0.4, 1)';

  const THEMES = {
    dark: {
      '--dock-panel': 'rgba(18, 22, 36, 0.78)',
      '--dock-panel-edge': 'rgba(139, 92, 246, 0.28)',
      '--dock-panel-highlight': 'rgba(255, 255, 255, 0.08)',
      '--dock-panel-shadow': '0 20px 44px -16px rgba(0, 0, 0, 0.85), 0 6px 16px -8px rgba(0, 0, 0, 0.5)',
      '--dock-tile': 'linear-gradient(180deg, #1e2438 0%, #101422 100%)',
      '--dock-tile-edge': 'rgba(139, 92, 246, 0.35)',
      '--dock-tile-highlight': 'rgba(255, 255, 255, 0.12)',
      '--dock-tile-shadow': '0 4px 10px -4px rgba(0, 0, 0, 0.7)',
      '--dock-ink': '#f8fafc',
      '--dock-label': '#090d16',
      '--dock-label-ink': '#38bdf8',
      '--dock-dot': '#38bdf8',
      '--dock-separator': 'rgba(139, 92, 246, 0.25)',
      '--dock-press': 'brightness(0.75)',
      '--dock-menu': 'rgba(20, 24, 38, 0.92)',
      '--dock-menu-edge': 'rgba(139, 92, 246, 0.4)',
      '--dock-menu-ink': '#f8fafc',
      '--dock-menu-muted': 'rgba(148, 163, 184, 0.55)',
      '--dock-menu-separator': 'rgba(139, 92, 246, 0.18)',
      '--dock-menu-shadow': '0 18px 40px -12px rgba(0, 0, 0, 0.75), 0 3px 10px rgba(0, 0, 0, 0.4)'
    },
    light: {
      '--dock-panel': 'rgba(240, 240, 243, 0.85)',
      '--dock-panel-edge': 'rgba(24, 24, 27, 0.08)',
      '--dock-panel-highlight': 'rgba(255, 255, 255, 0.95)',
      '--dock-panel-shadow': '0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)',
      '--dock-tile': 'linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)',
      '--dock-tile-edge': 'rgba(24, 24, 27, 0.08)',
      '--dock-tile-highlight': 'rgba(255, 255, 255, 1)',
      '--dock-tile-shadow': '0 4px 10px -5px rgba(24, 24, 27, 0.25)',
      '--dock-ink': '#27272a',
      '--dock-label': '#ffffff',
      '--dock-label-ink': '#18181b',
      '--dock-dot': 'rgba(24, 24, 27, 0.55)',
      '--dock-separator': 'rgba(24, 24, 27, 0.12)',
      '--dock-press': 'brightness(0.9)',
      '--dock-menu': 'rgba(248, 248, 250, 0.86)',
      '--dock-menu-edge': 'rgba(24, 24, 27, 0.1)',
      '--dock-menu-ink': '#18181b',
      '--dock-menu-muted': 'rgba(24, 24, 27, 0.4)',
      '--dock-menu-separator': 'rgba(24, 24, 27, 0.1)',
      '--dock-menu-shadow': '0 18px 40px -14px rgba(24, 24, 27, 0.3), 0 3px 10px rgba(24, 24, 27, 0.1)'
    }
  };

  const hasBadge = badge => badge !== undefined && badge !== null && badge !== false && badge !== '';
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

  const menuPath = (width, height, side, at) => {
    const r = MENU_RADIUS;
    const p = (x, y) => `${(x + TAIL).toFixed(2)} ${(y + TAIL).toFixed(2)}`;
    const tail = (x, y, dx, dy, nx, ny) => {
      const q = (u, v) => p(x + dx * u + nx * v, y + dy * u + ny * v);
      return `L ${q(-TAIL_HALF, 0)} L ${q(-TAIL_HALF * 0.18, TAIL * 0.82)} Q ${q(0, TAIL)} ${q(TAIL_HALF * 0.18, TAIL * 0.82)} L ${q(TAIL_HALF, 0)}`;
    };
    return [
      `M ${p(r, 0)}`,
      side === 'top' ? tail(at, 0, 1, 0, 0, -1) : '',
      `L ${p(width - r, 0)} A ${r} ${r} 0 0 1 ${p(width, r)}`,
      side === 'right' ? tail(width, at, 0, 1, 1, 0) : '',
      `L ${p(width, height - r)} A ${r} ${r} 0 0 1 ${p(width - r, height)}`,
      side === 'bottom' ? tail(at, height, -1, 0, 0, 1) : '',
      `L ${p(r, height)} A ${r} ${r} 0 0 1 ${p(0, height - r)}`,
      side === 'left' ? tail(0, at, 0, -1, -1, 0) : '',
      `L ${p(0, r)} A ${r} ${r} 0 0 1 ${p(r, 0)} Z`
    ].join(' ');
  };

  class Dock {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error(`Dock: container "${container}" not found`);
      }

      this.items = options.items || [];
      this.position = SIDES.includes(options.position) ? options.position : 'bottom';
      this.theme = options.theme || 'dark';
      this.baseItemSize = options.baseItemSize || 50;
      this.magnification = options.magnification || 70;
      this.distance = options.distance || 200;
      this.panelHeight = options.panelHeight || 68;
      this.gap = options.gap !== undefined ? options.gap : 10;
      this.roundness = options.roundness !== undefined ? options.roundness : 0.5;
      this.spring = Object.assign({ mass: 0.1, stiffness: 150, damping: 12 }, options.spring || {});
      this.bounce = options.bounce !== undefined ? options.bounce : true;
      this.autoHide = options.autoHide || false;
      this.tiles = options.tiles !== undefined ? options.tiles : true;
      this.showLabels = options.showLabels !== undefined ? options.showLabels : true;
      this.showIndicators = options.showIndicators !== undefined ? options.showIndicators : true;
      this.showBadges = options.showBadges !== undefined ? options.showBadges : true;
      this.badgeColor = options.badgeColor || '#ff453a';
      this.accentColor = options.accentColor || '#38bdf8';
      this.className = options.className || '';
      this.customStyle = options.style || {};

      this.itemNodes = [];
      this.motion = new Map();
      this.pointer = { x: 0, y: 0, inside: false };
      this.focused = -1;
      this.held = null;
      this.lastFocus = null;
      this.lastRest = [];
      this.fit = 1;
      this.raf = 0;
      this.lastTime = 0;
      this.alive = true;
      this.activeMenu = null;
      this.press = null;
      this.skipClick = -1;

      this.init();
    }

    init() {
      this.buildDOM();
      this.bindEvents();
      this.measure();
      this.wake();
    }

    buildDOM() {
      this.vertical = this.position === 'left' || this.position === 'right';
      const side = this.position;
      const rawBase = Math.max(16, this.baseItemSize);
      const rawPeak = Math.max(rawBase, this.magnification);
      const rawThickness = Math.max(rawBase, this.panelHeight);
      const rawGap = Math.max(0, this.gap);

      this.base = rawBase * this.fit;
      this.peak = rawPeak * this.fit;
      this.thickness = rawThickness * this.fit;
      this.currentGap = rawGap * this.fit;

      const tokens = Object.assign(
        {},
        THEMES[this.theme] || THEMES.dark,
        {
          '--dock-accent': this.accentColor,
          '--dock-badge': this.badgeColor,
          '--dock-base': `${this.base}px`,
          '--dock-thickness': `${this.thickness}px`,
          '--dock-gap': `${this.currentGap}px`,
          '--dock-pad': `${(this.thickness - this.base) / 2}px`,
          '--dock-reach': `${this.peak - this.base}px`,
          '--dock-round': clamp(this.roundness, 0, 1)
        }
      );

      this.root = document.createElement('div');
      this.root.className = `dock dock--${side}${this.tiles ? '' : ' dock--bare'}${this.className ? ` ${this.className}` : ''}`;
      this.root.setAttribute('role', 'toolbar');
      this.root.setAttribute('aria-label', 'Dock');
      this.root.setAttribute('aria-orientation', this.vertical ? 'vertical' : 'horizontal');

      for (const [key, val] of Object.entries(tokens)) {
        this.root.style.setProperty(key, val);
      }
      for (const [key, val] of Object.entries(this.customStyle)) {
        this.root.style[key] = val;
      }

      this.itemNodes = [];
      this.items.forEach((item, index) => {
        if (item && item.separator) {
          const sep = document.createElement('span');
          sep.className = 'dock-separator';
          sep.setAttribute('aria-hidden', 'true');
          this.root.appendChild(sep);
          this.itemNodes.push(null);
          return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dock-item${item.className ? ` ${item.className}` : ''}`;
        btn.setAttribute('aria-label', item.label || `Item ${index + 1}`);
        if (item.id) btn.setAttribute('data-id', item.id);
        btn.style.width = `${this.base}px`;
        btn.style.height = `${this.base}px`;

        const tile = document.createElement('span');
        tile.className = 'dock-tile';

        const face = document.createElement('span');
        face.className = 'dock-face';
        if (typeof item.icon === 'string') {
          face.innerHTML = item.icon;
        } else if (item.icon instanceof Node) {
          face.appendChild(item.icon);
        }
        tile.appendChild(face);

        if (this.showBadges && hasBadge(item.badge)) {
          const badge = document.createElement('span');
          badge.className = 'dock-badge';
          badge.textContent = item.badge === true ? '' : String(item.badge);
          tile.appendChild(badge);
        }

        btn.appendChild(tile);

        if (this.showIndicators && item.active) {
          const dot = document.createElement('span');
          dot.className = 'dock-dot';
          dot.setAttribute('aria-hidden', 'true');
          btn.appendChild(dot);
        }

        if (this.showLabels && item.label) {
          const label = document.createElement('span');
          label.className = 'dock-label';
          label.setAttribute('aria-hidden', 'true');
          label.textContent = item.label;
          btn.appendChild(label);
        }

        this.root.appendChild(btn);
        this.itemNodes.push(btn);
      });

      this.container.innerHTML = '';
      this.container.appendChild(this.root);
    }

    bindEvents() {
      this.onMove = e => {
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.pointer.inside = true;
        this.show();
        this.wake();
      };

      this.onLeave = () => {
        this.pointer.inside = false;
        this.wake();
        this.hideLater();
      };

      this.onFocusIn = () => this.show();
      this.onFocusOut = e => {
        if (!this.root.contains(e.relatedTarget)) this.hideLater();
      };

      this.root.addEventListener('pointermove', this.onMove);
      this.root.addEventListener('pointerdown', this.onMove);
      this.root.addEventListener('pointerleave', this.onLeave);
      this.root.addEventListener('pointercancel', this.onLeave);
      this.root.addEventListener('focusin', this.onFocusIn);
      this.root.addEventListener('focusout', this.onFocusOut);

      // Item interactions
      this.items.forEach((item, index) => {
        const node = this.itemNodes[index];
        if (!node) return;

        node.addEventListener('pointerenter', () => {
          node.setAttribute('data-hover', '');
        });

        node.addEventListener('pointerleave', () => {
          node.removeAttribute('data-hover');
        });

        node.addEventListener('click', e => {
          if (this.skipClick === index) {
            this.skipClick = -1;
            return;
          }
          if (this.bounce) {
            this.hop(index);
          }
          this.setActive(index);
          if (typeof item.onClick === 'function') {
            item.onClick(item, index, e);
          }
        });

        node.addEventListener('focus', () => {
          node.setAttribute('data-hover', '');
          this.focus(index);
        });
        node.addEventListener('blur', () => {
          node.removeAttribute('data-hover');
          this.focus(-1);
        });

        node.addEventListener('contextmenu', e => {
          if (!item.menu || !item.menu.length) return;
          e.preventDefault();
          this.endPress();
          this.openMenu(index, 'pointer');
        });

        node.addEventListener('pointerdown', e => {
          this.skipClick = -1;
          if (this.activeMenu) {
            this.closeMenu();
            return;
          }
          if (item.menu && item.menu.length && e.button === 0 && !e.ctrlKey) {
            this.startPress(e, index);
          }
        });
      });

      this.resizeObserver = new ResizeObserver(() => this.measure());
      const host = this.root.offsetParent || document.documentElement;
      this.resizeObserver.observe(host);
    }

    measure() {
      const rawBase = Math.max(16, this.baseItemSize);
      const rawPeak = Math.max(rawBase, this.magnification);
      const rawThickness = Math.max(rawBase, this.panelHeight);
      const rawGap = Math.max(0, this.gap);

      const length =
        this.items.reduce((sum, item) => sum + (item && item.separator ? 1 : rawBase), 0) +
        rawGap * Math.max(0, this.items.length - 1) +
        rawThickness -
        rawBase;

      const host = this.container || this.root.offsetParent || document.documentElement;
      const hostDimension = this.vertical ? (host.clientHeight || 300) : (host.clientWidth || (this.root.offsetParent ? this.root.offsetParent.clientWidth : 360));
      const room = Math.max(100, hostDimension - EDGE * 2);
      const next = length > 0 ? Math.min(1, Math.max(0.4, room / (length + rawPeak - rawBase))) : 1;
      this.fit = Math.round(next * 1000) / 1000;

      this.base = rawBase * this.fit;
      this.peak = rawPeak * this.fit;
      this.thickness = rawThickness * this.fit;
      this.currentGap = rawGap * this.fit;

      this.root.style.setProperty('--dock-base', `${this.base}px`);
      this.root.style.setProperty('--dock-thickness', `${this.thickness}px`);
      this.root.style.setProperty('--dock-gap', `${this.currentGap}px`);
      this.root.style.setProperty('--dock-pad', `${(this.thickness - this.base) / 2}px`);
      this.root.style.setProperty('--dock-reach', `${this.peak - this.base}px`);
      this.wake();
    }

    entry(index) {
      let state = this.motion.get(index);
      if (!state) {
        state = {
          size: this.base,
          velocity: 0,
          lift: 0,
          rise: 0,
          launch: 0,
          gravity: 0,
          hopping: false,
          drawn: '',
          node: null
        };
        this.motion.set(index, state);
      }
      return state;
    }

    tick(now) {
      this.raf = 0;
      if (!this.alive) return;

      const dt = Math.min(1 / 30, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      const rect = this.root.getBoundingClientRect();
      const center = this.vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
      const spans = this.items.map(item => (item && item.separator ? 1 : this.base));
      let cursor = -(spans.reduce((sum, span) => sum + span, 0) + this.currentGap * Math.max(0, spans.length - 1)) / 2;
      const rest = spans.map((span, index) => {
        const node = this.itemNodes[index];
        if (node && node.getBoundingClientRect) {
          const nRect = node.getBoundingClientRect();
          return (this.vertical ? (nRect.top + nRect.height / 2) : (nRect.left + nRect.width / 2)) - center;
        }
        const middle = cursor + span / 2;
        cursor += span + this.currentGap;
        return middle;
      });

      let focus = null;
      if (this.held !== null) focus = this.held;
      else if (this.pointer.inside) focus = (this.vertical ? this.pointer.y : this.pointer.x) - center;
      else if (rest[this.focused] !== undefined) focus = rest[this.focused];

      this.lastFocus = focus;
      this.lastRest = rest;

      const steps = Math.max(1, Math.ceil(dt * 240));
      const h = dt / steps;
      const k = this.spring.stiffness / this.spring.mass;
      const c = this.spring.damping / this.spring.mass;
      const distance = Math.max(1, this.distance) * this.fit;
      let moving = false;

      this.items.forEach((item, index) => {
        const node = this.itemNodes[index];
        if (!node || (item && item.separator)) return;

        const state = this.entry(index);
        const reach = focus === null ? 1 : Math.abs(focus - rest[index]) / distance;
        const target = this.base + (this.peak - this.base) * (reach < 1 ? Math.cos((reach * Math.PI) / 2) ** 2 : 0);

        for (let i = 0; i < steps; i++) {
          state.velocity = (state.velocity + h * k * (target - state.size)) / (1 + h * c + h * h * k);
          state.size += state.velocity * h;

          if (state.hopping) {
            state.rise -= state.gravity * h;
            state.lift += state.rise * h;
            if (state.lift <= 0) {
              state.lift = 0;
              state.rise *= -0.36;
              if (state.rise < state.launch * 0.2) {
                state.rise = 0;
                state.hopping = false;
                node.removeAttribute('data-hop');
              }
            }
          }
        }

        if (Math.abs(state.velocity) < 0.01 && Math.abs(target - state.size) < 0.01) {
          state.size = target;
          state.velocity = 0;
        } else {
          moving = true;
        }
        if (state.hopping) moving = true;

        const size = Math.max(1, state.size);
        const drawn = `${size.toFixed(2)} ${state.lift.toFixed(2)} ${this.position}`;
        if (drawn === state.drawn && node === state.node) return;
        state.drawn = drawn;
        state.node = node;

        const lift = this.position === 'bottom' || this.position === 'right' ? -state.lift : state.lift;
        const tile = node.firstElementChild;
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        if (tile) {
          tile.style.transform = `translate(${this.vertical ? `${lift}px, 0` : `0, ${lift}px`}) scale(${size / this.base})`;
        }
      });

      if (moving) {
        this.raf = requestAnimationFrame(t => this.tick(t));
      }
    }

    wake() {
      if (this.raf || !this.alive) return;
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(t => this.tick(t));
    }

    hop(index) {
      const node = this.itemNodes[index];
      if (!this.bounce || !node) return;
      const state = this.entry(index);
      if (state.hopping) return;

      const height = state.size * HOP;
      state.gravity = (8 * height) / (HOP_TIME * HOP_TIME);
      state.launch = (state.gravity * HOP_TIME) / 2;
      state.rise = state.launch;
      state.hopping = true;
      node.setAttribute('data-hop', '');
      this.wake();
    }

    focus(index) {
      this.focused = index;
      this.wake();
    }

    show() {
      window.clearTimeout(this.hideTimer);
      if (this.root.hasAttribute('data-hidden')) {
        this.root.removeAttribute('data-hidden');
      }
    }

    hide() {
      window.clearTimeout(this.hideTimer);
      const blocked = this.pointer.inside || this.held !== null || this.root.contains(document.activeElement);
      if (!this.autoHide || blocked) return;
      this.root.setAttribute('data-hidden', '');
    }

    hideLater() {
      if (!this.autoHide) return;
      window.clearTimeout(this.hideTimer);
      this.hideTimer = window.setTimeout(() => this.hide(), 600);
    }

    setActive(index) {
      this.items.forEach((item, i) => {
        if (!item) return;
        const node = this.itemNodes[i];
        if (!node) return;

        item.active = i === index;
        let dot = node.querySelector('.dock-dot');
        if (item.active) {
          if (!dot && this.showIndicators) {
            dot = document.createElement('span');
            dot.className = 'dock-dot';
            dot.setAttribute('aria-hidden', 'true');
            node.appendChild(dot);
          }
        } else {
          if (dot) dot.remove();
        }
      });
      this.wake();
    }

    setBadge(index, badge) {
      const item = this.items[index];
      const node = this.itemNodes[index];
      if (!item || !node) return;

      item.badge = badge;
      const tile = node.querySelector('.dock-tile');
      if (!tile) return;

      let badgeEl = tile.querySelector('.dock-badge');
      if (hasBadge(badge) && this.showBadges) {
        if (!badgeEl) {
          badgeEl = document.createElement('span');
          badgeEl.className = 'dock-badge';
          tile.appendChild(badgeEl);
        }
        badgeEl.textContent = badge === true ? '' : String(badge);
      } else {
        if (badgeEl) badgeEl.remove();
      }
    }

    setLabel(index, label) {
      const item = this.items[index];
      const node = this.itemNodes[index];
      if (!item || !node) return;

      item.label = label;
      node.setAttribute('aria-label', label);
      let labelEl = node.querySelector('.dock-label');
      if (labelEl) {
        labelEl.textContent = label;
      }
    }

    // Context Menu Handling
    openMenu(index, mode) {
      const item = this.items[index];
      const node = this.itemNodes[index];
      if (!item || !item.menu || !item.menu.length || !node) return;

      this.closeMenu();
      const rect = node.getBoundingClientRect();
      const point = {
        bottom: { x: rect.left + rect.width / 2, y: rect.top - MENU_GAP },
        top: { x: rect.left + rect.width / 2, y: rect.bottom + MENU_GAP },
        left: { x: rect.right + MENU_GAP, y: rect.top + rect.height / 2 },
        right: { x: rect.left - MENU_GAP, y: rect.top + rect.height / 2 }
      }[this.position];

      this.activeMenu = this.createMenuElement(item.menu, item.label, point);
      document.body.appendChild(this.activeMenu);
      node.setAttribute('data-open', '');
    }

    createMenuElement(rows, label, point) {
      const outer = document.createElement('div');
      outer.className = 'dock-menu';
      outer.setAttribute('data-dock-menu', '');

      for (const [key, val] of Object.entries(THEMES[this.theme] || THEMES.dark)) {
        outer.style.setProperty(key, val);
      }
      outer.style.setProperty('--dock-accent', this.accentColor);

      const shadow = document.createElement('span');
      shadow.className = 'dock-menu-shadow';

      const glass = document.createElement('span');
      glass.className = 'dock-menu-glass';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'dock-menu-shape');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.appendChild(path);

      const list = document.createElement('div');
      list.className = 'dock-menu-list';
      list.setAttribute('role', 'menu');
      if (label) list.setAttribute('aria-label', label);
      list.tabIndex = -1;

      const highlight = document.createElement('span');
      highlight.className = 'dock-menu-highlight';
      list.appendChild(highlight);

      rows.forEach((row, i) => {
        if (!row) return;
        if (row.separator) {
          const sep = document.createElement('span');
          sep.className = 'dock-menu-separator';
          sep.setAttribute('role', 'separator');
          list.appendChild(sep);
          return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dock-menu-row';
        btn.setAttribute('role', 'menuitem');
        if (row.disabled) btn.setAttribute('aria-disabled', 'true');

        if (row.icon) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'dock-menu-icon';
          iconSpan.innerHTML = row.icon;
          btn.appendChild(iconSpan);
        }

        const text = document.createElement('span');
        text.className = 'dock-menu-text';
        text.textContent = row.label;
        btn.appendChild(text);

        if (row.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'dock-menu-shortcut';
          shortcut.textContent = row.shortcut;
          btn.appendChild(shortcut);
        }

        btn.addEventListener('pointerenter', () => {
          highlight.style.transform = `translateY(${btn.offsetTop}px)`;
          highlight.style.height = `${btn.offsetHeight}px`;
          highlight.style.opacity = '1';
        });

        btn.addEventListener('click', e => {
          if (row.disabled) return;
          this.closeMenu();
          if (typeof row.onClick === 'function') row.onClick(row, i, e);
        });

        list.appendChild(btn);
      });

      outer.appendChild(shadow);
      outer.appendChild(glass);
      outer.appendChild(svg);
      outer.appendChild(list);

      requestAnimationFrame(() => {
        const width = list.offsetWidth || 180;
        const height = list.offsetHeight || 100;
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const left = clamp(point.x - width / 2, MARGIN, vw - MARGIN - width);
        const top = this.position === 'bottom' ? point.y - TAIL - height : point.y + TAIL;
        const at = clamp(point.x - left, MENU_RADIUS + TAIL_HALF, width - MENU_RADIUS - TAIL_HALF);

        outer.style.left = `${left}px`;
        outer.style.top = `${top}px`;
        outer.style.visibility = 'visible';

        const p = menuPath(width, height, this.position, at);
        glass.style.clipPath = `path('${p}')`;
        path.setAttribute('d', p);
        outer.animate([{ transform: 'scale(0.85)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], {
          duration: 220,
          easing: POP
        });
      });

      const closeHandler = e => {
        if (!outer.contains(e.target)) {
          this.closeMenu();
          document.removeEventListener('pointerdown', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 10);

      return outer;
    }

    closeMenu() {
      if (this.activeMenu) {
        this.activeMenu.remove();
        this.activeMenu = null;
      }
      this.itemNodes.forEach(node => {
        if (node) node.removeAttribute('data-open');
      });
    }

    startPress(e, index) {
      this.endPress();
      const onUp = () => {
        this.endPress();
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointerup', onUp, { once: true });
      window.addEventListener('pointercancel', onUp, { once: true });

      this.press = {
        timer: setTimeout(() => {
          this.openMenu(index, 'press');
          this.skipClick = index;
        }, HOLD_TIME),
        cleanup: () => {
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        }
      };
    }

    endPress() {
      if (this.press) {
        clearTimeout(this.press.timer);
        if (typeof this.press.cleanup === 'function') this.press.cleanup();
        this.press = null;
      }
    }

    destroy() {
      this.alive = false;
      cancelAnimationFrame(this.raf);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.closeMenu();
      this.container.innerHTML = '';
    }
  }

  // Pre-packaged SVG glyphs
  Dock.GLYPHS = {
    packages: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
    variables: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
    env: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 3-9.5 9.5M15.5 7.5l3 3M18.5 4.5l2 2"/></svg>',
    details: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>'
  };

  global.Dock = Dock;
  if (typeof window !== 'undefined') window.Dock = Dock;
})(typeof window !== 'undefined' ? window : this);
