'use strict';
/* ==========================================================
   PLUCK — script.js
   Jules-exact animations adapted for Pluck:
   1. Matrix rain canvas background
   2. ASCII art hero title
   3. Floating scattered characters
   4. Pixel art characters (4 animated sprites)
   5. Pixel mascot (brain/gears split body)
   6. Animated dot-grid background
   7. Zigzag pixel dividers
   8. Scroll reveal
   9. Navbar scroll effect
   10. Plans pixel decoration
   11. Chat bubble + mini mascot
   ========================================================== */

/* ── 1. Matrix rain background canvas ─────────────── */
(function initMatrixRain() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>=+-*/%&|!?;:.,';
  let cols, drops;
  const FONT_SIZE = 13;
  const COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.floor(canvas.width / FONT_SIZE);
    drops = Array.from({ length: cols }, () => Math.random() * -50);
  }

  function draw() {
    // Fade trail
    ctx.fillStyle = 'rgba(14, 5, 40, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${FONT_SIZE}px 'Space Mono', monospace`;

    for (let i = 0; i < cols; i++) {
      // Only draw ~8% of columns at any time (sparse, like Jules)
      if (Math.random() > 0.08) continue;

      const char = CHARS[Math.floor(Math.random() * CHARS.length)];
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;
      ctx.fillText(char, i * FONT_SIZE, drops[i] * FONT_SIZE);

      // Reset drop at bottom
      if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i] += 0.3;
    }
    ctx.globalAlpha = 1;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  setInterval(draw, 60);
})();

/* ── 2. Hero ASCII dynamic logo canvas (exact Jules implementation) ── */
(function initHeroLogo() {
  const canvas = document.getElementById('hero-logo-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const config = {
    desktopLogoText: [
      "  :MMW00000000k.   :MMW     :MMW        kMMd   .dXMMMMMMKl.   :MMW     .dWMX  ",
      "  :MMW''''''''kMMd :MMW     :MMW        kMMd  ,WMN;''''''''   :MMW   .xMM0;   ",
      "  :MMW        kMMd :MMW     :MMW        kMMd  OMMN            :MMW .dWMX:     ",
      "  :MMW00000000XWMc :MMW     :MMW        kMMd  OMMN            :MMWXMMNk.      ",
      "  :MMWkkkkkkkd:'   :MMW     :MMW        kMMd  OMMN            :MMW''xMM0,     ",
      "  :MMW             :MMW     .XMM0.    .xMMO   'WMN;........   :MMW   .kMMNd.  ",
      "  :MMW             :MMW00k.  .oKWMMMMMMWKc     .dXMMMMMMKl.   :MMW     :XMMWc ",
      "  .::;             .::::::;    .':cllc:'.        .':cllc:'.   .::;      .::;  "
    ],
    mobileLogoText: [
      " :MM000k.  :MMo   :MMo  kMM;   .o0XNX0o.  :MMo .dWM ",
      " :MMo'dMMl :MMo   :MMo  kMM;  oMMd'  dMMl :MMWXMMNk ",
      " :MM000NWN :MMo   :MMo  kMM;  OMMN       :MMW.dWMX  ",
      " :MMo      :MMo   :MMo  kMM;  OMMN       :MMWXMMNd  ",
      " :MMo      :MM0k. .0MMXXMM0'   'xKWMMWKo  :MMo 'kMM ",
      " .::.      .::::;  .'clc:'.      .::::.   .::.  .:: "
    ],
    fontSize: 15,
    fontFamily: "'Space Mono', 'SF Mono', monospace",
    fontWeight: 'bold',
    textColor: '#A78BFA',
    backgroundColor: '#1D0245',
    emptySlotChar: '.',
    emptySlotColor: '#3B1E6E',
    ejectedPieceColors: ['#EC4899', '#06B6D4', '#F59E0B', '#C084FC'],
    ejectionIntervalMs: 1200,
    ejectedPieceBaseSpeed: 2.2,
    ejectedPieceDamping: 0.985,
    maxEjectedPieces: 6,
    initialEjectedPiecesCount: 3,
    robotChar: '@',
    robotColor: '#FFFBEB',
    robotMoveInterval: 2,
    robotPickupDelay: 4,
    robotPlaceDelay: 4,
    logicalCharWidth: 84,
    logicalCharHeight: 12,
    mobileLogicalCharWidth: 54,
    mobileLogicalCharHeight: 10
  };

  let charWidth = 0;
  let charHeight = 0;
  let logoSlots = [];
  let ejectedPieces = [];
  let robot = {};
  let animFrameId = null;
  let lastTime = 0;
  let ejectionTimer = 0;
  let isMobile = window.innerWidth < 768;
  let isPaused = false;

  function measureFont() {
    ctx.font = `${config.fontWeight} ${config.fontSize}px ${config.fontFamily}`;
    charWidth = ctx.measureText('M').width || 9.6;
    charHeight = config.fontSize * 1.25;
    return charWidth > 0;
  }

  function setupSlots() {
    logoSlots = [];
    const logoLines = isMobile ? config.mobileLogoText : config.desktopLogoText;
    const numRows = logoLines.length;
    const numCols = Math.max(...logoLines.map(l => l.length));

    const totalTextW = numCols * charWidth;
    const totalTextH = numRows * charHeight;

    const startX = Math.floor((canvas.width - totalTextW) / 2);
    const startY = Math.floor((canvas.height - totalTextH) / 2);

    for (let r = 0; r < numRows; r++) {
      const line = logoLines[r] || '';
      for (let c = 0; c < numCols; c++) {
        const ch = line[c] || ' ';
        if (ch !== ' ') {
          logoSlots.push({
            originalChar: ch,
            isSlotEmpty: false,
            gridR: r,
            gridC: c,
            canvasX: startX + c * charWidth,
            canvasY: startY + r * charHeight,
            isTargetedForReturn: false
          });
        }
      }
    }
  }

  function ejectPiece(slot) {
    if (!slot || slot.isSlotEmpty || ejectedPieces.length >= config.maxEjectedPieces) return false;
    slot.isSlotEmpty = true;
    const angle = Math.random() * Math.PI * 2;
    const speed = config.ejectedPieceBaseSpeed * (0.7 + Math.random() * 0.7);
    const color = config.ejectedPieceColors[Math.floor(Math.random() * config.ejectedPieceColors.length)];

    ejectedPieces.push({
      char: slot.originalChar,
      gridR: slot.gridR,
      gridC: slot.gridC,
      x: slot.canvasX + charWidth / 2,
      y: slot.canvasY + charHeight / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: color,
      isTargetedForPickup: false
    });
    return true;
  }

  function initInitialEjections() {
    const available = [...logoSlots];
    for (let i = 0; i < config.initialEjectedPiecesCount && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const slot = available.splice(idx, 1)[0];
      ejectPiece(slot);
    }
  }

  function initRobot() {
    const logicalW = isMobile ? config.mobileLogicalCharWidth : config.logicalCharWidth;
    const logicalH = isMobile ? config.mobileLogicalCharHeight : config.logicalCharHeight;
    robot = {
      gridC: Math.floor(logicalW / 2),
      gridR: Math.floor(logicalH / 2) + 2,
      char: config.robotChar,
      color: config.robotColor,
      state: 'IDLE',
      targetPiece: null,
      targetSlot: null,
      carryingPieceData: null,
      moveTimer: 0,
      actionTimer: 0
    };
  }

  function resizeCanvas() {
    isMobile = window.innerWidth < 768;
    config.fontSize = isMobile ? 11 : (window.innerWidth < 1024 ? 13 : 15);
    measureFont();

    const logicalW = isMobile ? config.mobileLogicalCharWidth : config.logicalCharWidth;
    const logicalH = isMobile ? config.mobileLogicalCharHeight : config.logicalCharHeight;

    canvas.width = Math.floor(logicalW * charWidth);
    canvas.height = Math.floor(logicalH * charHeight);

    setupSlots();
    if (!robot.state) initRobot();
  }

  function moveRobotTowards(r, targetC, targetR) {
    const dc = targetC - r.gridC;
    const dr = targetR - r.gridR;
    if (dc === 0 && dr === 0) return false;

    if (Math.abs(dr) >= Math.abs(dc)) {
      r.gridR += Math.sign(dr);
    } else {
      r.gridC += Math.sign(dc);
    }
    r.moveTimer = config.robotMoveInterval;
    return true;
  }

  function updateRobot() {
    if (robot.moveTimer > 0) robot.moveTimer--;
    if (robot.actionTimer > 0) robot.actionTimer--;

    switch (robot.state) {
      case 'IDLE': {
        let bestDist = Infinity;
        let bestPiece = null;
        for (const p of ejectedPieces) {
          if (!p.isTargetedForPickup) {
            const pc = Math.round(p.x / charWidth);
            const pr = Math.round(p.y / charHeight);
            const d = (robot.gridC - pc) ** 2 + (robot.gridR - pr) ** 2;
            if (d < bestDist) {
              bestDist = d;
              bestPiece = p;
            }
          }
        }
        if (bestPiece) {
          robot.targetPiece = bestPiece;
          bestPiece.isTargetedForPickup = true;
          robot.state = 'MOVING_TO_PICKUP';
        }
        break;
      }
      case 'MOVING_TO_PICKUP': {
        if (!robot.targetPiece) {
          robot.state = 'IDLE';
          break;
        }
        const pc = Math.round(robot.targetPiece.x / charWidth);
        const pr = Math.round(robot.targetPiece.y / charHeight);
        if (robot.gridC === pc && robot.gridR === pr) {
          robot.state = 'AT_PIECE';
          robot.actionTimer = config.robotPickupDelay;
        } else if (robot.moveTimer <= 0) {
          moveRobotTowards(robot, pc, pr);
        }
        break;
      }
      case 'AT_PIECE': {
        if (robot.actionTimer <= 0) {
          if (robot.targetPiece) {
            robot.carryingPieceData = {
              char: robot.targetPiece.char,
              gridR: robot.targetPiece.gridR,
              gridC: robot.targetPiece.gridC
            };
            ejectedPieces = ejectedPieces.filter(p => p !== robot.targetPiece);
            robot.targetPiece = null;
            robot.targetSlot = logoSlots.find(
              s => s.gridR === robot.carryingPieceData.gridR && s.gridC === robot.carryingPieceData.gridC
            );
            if (robot.targetSlot) {
              robot.targetSlot.isTargetedForReturn = true;
              robot.state = 'MOVING_TO_SLOT';
            } else {
              robot.state = 'IDLE';
              robot.carryingPieceData = null;
            }
          } else {
            robot.state = 'IDLE';
          }
        }
        break;
      }
      case 'MOVING_TO_SLOT': {
        if (!robot.targetSlot) {
          robot.state = 'IDLE';
          break;
        }
        const sc = Math.floor(robot.targetSlot.canvasX / charWidth);
        const sr = Math.floor(robot.targetSlot.canvasY / charHeight);
        if (robot.gridC === sc && robot.gridR === sr) {
          robot.state = 'AT_SLOT';
          robot.actionTimer = config.robotPlaceDelay;
        } else if (robot.moveTimer <= 0) {
          moveRobotTowards(robot, sc, sr);
        }
        break;
      }
      case 'AT_SLOT': {
        if (robot.actionTimer <= 0) {
          if (robot.targetSlot && robot.carryingPieceData) {
            robot.targetSlot.isSlotEmpty = false;
            robot.targetSlot.isTargetedForReturn = false;
          }
          robot.carryingPieceData = null;
          robot.targetSlot = null;
          robot.state = 'IDLE';
        }
        break;
      }
    }
  }

  function updatePhysics(dt) {
    ejectionTimer += dt;
    if (ejectionTimer >= config.ejectionIntervalMs && ejectedPieces.length < config.maxEjectedPieces) {
      ejectionTimer = 0;
      const filled = logoSlots.filter(s => !s.isSlotEmpty);
      if (filled.length > 0) {
        ejectPiece(filled[Math.floor(Math.random() * filled.length)]);
      }
    }

    for (let i = ejectedPieces.length - 1; i >= 0; i--) {
      const p = ejectedPieces[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= config.ejectedPieceDamping;
      p.vy *= config.ejectedPieceDamping;

      if (p.x < charWidth) { p.x = charWidth; p.vx *= -1; }
      if (p.x > canvas.width - charWidth) { p.x = canvas.width - charWidth; p.vx *= -1; }
      if (p.y < charHeight) { p.y = charHeight; p.vy *= -1; }
      if (p.y > canvas.height - charHeight) { p.y = canvas.height - charHeight; p.vy *= -1; }
    }
  }

  function render() {
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${config.fontWeight} ${config.fontSize}px ${config.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (const slot of logoSlots) {
      if (slot.isSlotEmpty) {
        ctx.fillStyle = config.emptySlotColor;
        ctx.fillText(config.emptySlotChar, slot.canvasX, slot.canvasY);
      } else {
        ctx.fillStyle = config.textColor;
        ctx.fillText(slot.originalChar, slot.canvasX, slot.canvasY);
      }
    }

    for (const p of ejectedPieces) {
      const c = Math.round(p.x / charWidth);
      const r = Math.round(p.y / charHeight);
      ctx.fillStyle = p.color;
      ctx.fillText(p.char, c * charWidth, r * charHeight);
    }

    if (robot.gridC !== undefined && robot.gridR !== undefined) {
      ctx.fillStyle = robot.color;
      ctx.fillText(robot.char, robot.gridC * charWidth, robot.gridR * charHeight);

      if (robot.carryingPieceData) {
        ctx.fillStyle = '#F59E0B';
        ctx.fillText(robot.carryingPieceData.char, (robot.gridC + 1) * charWidth, robot.gridR * charHeight);
      }
    }
  }

  function loop(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min(time - lastTime, 100);
    lastTime = time;

    if (!isPaused) {
      updatePhysics(dt);
      updateRobot();
      render();
    }
    animFrameId = requestAnimationFrame(loop);
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const nearest = [...logoSlots.filter(s => !s.isSlotEmpty)]
      .map(s => ({ slot: s, dist: (s.canvasX - clickX) ** 2 + (s.canvasY - clickY) ** 2 }))
      .sort((a, b) => a.dist - b.dist);

    for (let i = 0; i < Math.min(4, nearest.length); i++) {
      ejectPiece(nearest[i].slot);
    }
  });

  const observer = new IntersectionObserver(([entry]) => {
    isPaused = !entry.isIntersecting;
  }, { threshold: 0.05 });
  observer.observe(canvas);

  window.addEventListener('resize', resizeCanvas, { passive: true });

  resizeCanvas();
  initInitialEjections();
  initRobot();
  animFrameId = requestAnimationFrame(loop);
})();

/* ── 3. Floating matrix char sparks ───────────────── */
(function initMatrixFloaters() {
  const container = document.getElementById('matrix-floaters');
  if (!container) return;

  const CHARS = ['x', 'X', 'M', 'W', 'o', ':', ',', '.', ';', "'", 'd', 'k', 'K', 'O..XM.X.'];
  const COLORS = ['#ec4899', '#f59e0b', '#06b6d4', '#c084fc', '#fffbeb'];
  const COUNT = 36;

  for (let i = 0; i < COUNT; i++) {
    const span = document.createElement('span');
    span.className = 'mf-char';
    span.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
    span.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    span.style.left = `${Math.random() * 100}%`;
    span.style.top = `${6 + Math.random() * 88}%`;
    span.style.setProperty('--dur', `${7 + Math.random() * 9}s`);
    span.style.setProperty('--delay', `${Math.random() * 8}s`);
    span.style.fontSize = `${11 + Math.floor(Math.random() * 7)}px`;
    container.appendChild(span);
  }

  setInterval(() => {
    const spans = container.querySelectorAll('.mf-char');
    spans.forEach(s => {
      if (Math.random() > 0.72) {
        s.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
      }
    });
  }, 750);
})();

/* ── 4. Human Reference Pixel Characters Interactions ─────────── */
(function initPixelCharacters() {
  const items = document.querySelectorAll('.pixel-char-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      item.style.transform = 'translateY(-14px) scale(1.18)';
      setTimeout(() => {
        item.style.transform = '';
      }, 350);
    });
  });
})();

/* ── 5. Jules Octopus Mascot & Pupil Interaction ─────────────── */
(function initMascot() {
  const pupil = document.getElementById('mascot-pupil');
  const energyCanvas = document.getElementById('mascot-energy-canvas');
  const featuresSection = document.getElementById('features');

  if (pupil && featuresSection) {
    let currentX = 0, currentY = 0;
    let targetX = 0, targetY = 0;

    // Track mouse over the features section
    featuresSection.addEventListener('mousemove', (e) => {
      const rect = pupil.getBoundingClientRect();
      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height / 2;

      const dx = e.clientX - eyeCenterX;
      const dy = e.clientY - eyeCenterY;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        const maxOffset = 5.5;
        const factor = Math.min(dist / 320, 1);
        targetX = (dx / dist) * maxOffset * factor;
        targetY = (dy / dist) * maxOffset * factor;
      }
    });

    featuresSection.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
    });

    // Specific card hover snaps
    const cardTargets = {
      'feat-search': { x: -5, y: -4 },
      'feat-deps': { x: -5, y: 3 },
      'feat-secret': { x: 5, y: -4 },
      'feat-mcp': { x: 5, y: 3 }
    };

    Object.entries(cardTargets).forEach(([id, offset]) => {
      const card = document.getElementById(id);
      if (card) {
        card.addEventListener('mouseenter', () => {
          targetX = offset.x;
          targetY = offset.y;
        });
      }
    });

    function updatePupil() {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      pupil.style.transform = `translate(calc(-50% + ${currentX.toFixed(2)}px), calc(-50% + ${currentY.toFixed(2)}px))`;
      requestAnimationFrame(updatePupil);
    }
    updatePupil();
  }

  // Micro electrical impulses on the cybernetic brain/gear/pipes
  if (energyCanvas) {
    const ctx = energyCanvas.getContext('2d');
    const W = 410, H = 410;
    energyCanvas.width = W;
    energyCanvas.height = H;

    // Proportional coordinates for 410x410 octopus (scale ~1.464)
    const sparks = Array.from({ length: 12 }, () => ({
      x: 215 + Math.random() * 95,
      y: 60 + Math.random() * 260,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      color: Math.random() > 0.5 ? '#06b6d4' : '#f59e0b',
      life: Math.random() * 30,
      maxLife: 30 + Math.random() * 40,
      size: 2.5 + Math.random() * 2.5
    }));

    let gearAngle = 0;

    function drawSparks() {
      ctx.clearRect(0, 0, W, H);

      // Rotating subtle aura around the pink gear at (249, 196)
      gearAngle += 0.025;
      ctx.save();
      ctx.translate(249, 196);
      ctx.rotate(gearAngle);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-18, -18, 36, 36);
      ctx.restore();

      // Cybernetic spark nodes
      sparks.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        // Keep inside right half of octopus
        if (s.x < 208) { s.x = 208; s.vx *= -1; }
        if (s.x > 320) { s.x = 320; s.vx *= -1; }
        if (s.y < 50)  { s.y = 50;  s.vy *= -1; }
        if (s.y > 350) { s.y = 350; s.vy *= -1; }

        if (s.life > s.maxLife) {
          s.x = 215 + Math.random() * 95;
          s.y = 60 + Math.random() * 260;
          s.life = 0;
        }

        const alpha = Math.sin((s.life / s.maxLife) * Math.PI) * 0.9;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      });
      ctx.globalAlpha = 1;

      requestAnimationFrame(drawSparks);
    }
    drawSparks();
  }
})();

/* ── 6. Authentic Jules PatternGrid Wave & Swimming Fish Background ────── */
(function initDotGrid() {
  const canvas = document.getElementById('dot-grid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Exact Jules 3x3 pattern matrices
  const ZE_PATTERNS = [
    [[0,0,0],[0,1,0],[0,0,0]], // 0: single center dot
    [[1,0,1],[0,0,0],[1,0,1]], // 1: 4 corner dots
    [[0,1,0],[1,1,1],[0,1,0]], // 2: plus sign (+)
    [[0,0,0],[1,1,1],[0,0,0]], // 3: horizontal line (-)
    [[0,1,0],[0,1,0],[0,1,0]], // 4: vertical line (|)
    [[0,0,0],[0,0,0],[0,0,0]], // 5: empty space
    [[1,0,1],[0,1,0],[1,0,1]]  // 6: X shape
  ];

  // Exact Jules pixel fish shapes (4 columns x 3 rows)
  const FISH_SHAPE_RIGHT = [
    { c: 0, r: 1 },
    { c: 1, r: 0 }, { c: 1, r: 1 }, { c: 1, r: 2 },
    { c: 2, r: 0 }, { c: 2, r: 1 }, { c: 2, r: 2 },
    { c: 3, r: 0 }, { c: 3, r: 1 }, { c: 3, r: 2 }
  ];
  const FISH_SHAPE_LEFT = FISH_SHAPE_RIGHT.map(p => ({ c: 3 - p.c, r: p.r }));

  // Softer, elegant color palette (less bright, non-distracting)
  const WATER_TINT = 'rgba(18, 4, 44, 0.35)';
  const DOT_COLOR = 'rgba(80, 24, 150, 0.45)';
  const VARIANT_COLOR = 'rgba(105, 35, 185, 0.55)';
  const HIGHLIGHT_COLOR = 'rgba(130, 50, 220, 0.65)';
  const FISH_COLORS = ['#52e7fb', '#a855f7', '#38bdf8', '#c084fc'];

  let width = 0;
  let height = 0;
  let C = 5; // Sub-pixel cell dimension (spaced out)
  let R = 15; // Pattern cell dimension (3 * C)
  let cols = 0;
  let rows = 0;
  let grid = [];
  let fishes = [];
  let wavePhase = 0;

  // Jules wave configuration: gentle undulation behind octopus and cards
  const waveBaseY = 185;
  const waveAmp = 65;

  function resize() {
    const section = canvas.parentElement;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    width = Math.round(rect.width) || window.innerWidth;
    height = Math.round(rect.height) || 800;

    if (width <= 0 || height <= 0) return;

    // Spaced out grid cells so it is airy and uncrowded
    C = width < 768 ? 4 : 5;
    R = C * 3;

    canvas.width = width;
    canvas.height = height;

    cols = Math.ceil(width / R);
    rows = Math.ceil(height / R);

    // Initialize grid patterns with 45% empty space and mostly subtle single dots
    grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        let patIdx = 5; // default empty
        const rand = Math.random();
        if (rand < 0.45) patIdx = 5;      // 45% empty space (airy, uncrowded)
        else if (rand < 0.90) patIdx = 0; // 45% subtle center dot (.)
        else if (rand < 0.95) patIdx = 2; // 5% plus sign (+)
        else if (rand < 0.98) patIdx = 3; // 3% horizontal dash (-)
        else patIdx = 1;                  // 2% corners
        row.push(patIdx);
      }
      grid.push(row);
    }

    // Initialize 6 leisurely swimming fish
    if (fishes.length === 0) {
      const numFish = 6;
      const maxSubX = Math.floor(width / C) - 4;
      const minSubY = Math.floor((waveBaseY + waveAmp) / C);
      const maxSubY = Math.floor(height / C) - 4;

      for (let i = 0; i < numFish; i++) {
        fishes.push({
          id: i,
          x: Math.floor(Math.random() * maxSubX),
          y: Math.floor(minSubY + Math.random() * Math.max(10, maxSubY - minSubY)),
          dx: Math.random() < 0.5 ? 1 : -1,
          color: FISH_COLORS[i % FISH_COLORS.length],
          moveCounter: Math.floor(Math.random() * 8),
          moveSpeed: 8 + (i % 4) // slow, leisurely swim (takes step every 8-11 frames)
        });
      }
    }
  }

  // Calculate wave surface Y at given X coordinate
  function getWaveY(x, phase) {
    if (width <= 0) return waveBaseY;
    const normX = Math.max(0, Math.min(1, x / width));
    return waveBaseY - waveAmp * Math.cos(normX * 2 * Math.PI * 2 + phase)
           + 10 * Math.sin(normX * 2 * Math.PI * 4 + phase * 1.3);
  }

  let lastVariantTime = 0;

  function render(time) {
    if (width <= 0 || height <= 0) {
      resize();
    }

    ctx.clearRect(0, 0, width, height);

    // Slow, serene wave drift
    wavePhase += 0.0016;

    // Mutate only 4-5 cells every 1600ms (calm, non-distracting twinkle)
    if (time - lastVariantTime > 1600) {
      lastVariantTime = time;
      for (let k = 0; k < 5; k++) {
        const randR = Math.floor(Math.random() * rows);
        const randC = Math.floor(Math.random() * cols);
        if (grid[randR] && grid[randR][randC] !== undefined) {
          const rand = Math.random();
          grid[randR][randC] = rand < 0.50 ? 5 : (rand < 0.90 ? 0 : 2);
        }
      }
    }

    // 1. Draw soft water tint below the wave
    ctx.fillStyle = WATER_TINT;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, getWaveY(0, wavePhase));
    for (let x = 6; x <= width; x += 6) {
      ctx.lineTo(x, getWaveY(x, wavePhase));
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 2. Draw pixel grid cells below the undulating wave line (calm, uncrowded)
    for (let r = 0; r < rows; r++) {
      const cellY = r * R;
      for (let c = 0; c < cols; c++) {
        const cellX = c * R;
        const waveTop = getWaveY(cellX, wavePhase);

        // Above the wave crest -> empty
        if (cellY + R < waveTop) continue;

        const patIdx = grid[r]?.[c] ?? 5;
        if (patIdx === 5) continue; // empty space
        const pat = ZE_PATTERNS[patIdx];
        if (!pat) continue;

        // Color selection: subdued so foreground elements pop
        if (patIdx === 2) {
          ctx.fillStyle = VARIANT_COLOR;
        } else if (patIdx === 0) {
          ctx.fillStyle = DOT_COLOR;
        } else {
          ctx.fillStyle = DOT_COLOR;
        }

        for (let pr = 0; pr < 3; pr++) {
          for (let pc = 0; pc < 3; pc++) {
            if (pat[pr][pc] === 1) {
              const px = cellX + pc * C;
              const py = cellY + pr * C;
              if (py >= waveTop - C / 2) {
                ctx.fillRect(px, py, C, C);
              }
            }
          }
        }
      }
    }

    // 3. Update and draw leisurely swimming pixel fish
    const maxSubX = Math.floor(width / C) - 4;
    const maxSubY = Math.floor(height / C) - 4;

    fishes.forEach(fish => {
      fish.moveCounter++;
      if (fish.moveCounter >= fish.moveSpeed) {
        fish.moveCounter = 0;

        fish.x += fish.dx;

        // Occasional gentle vertical drift
        if (Math.random() < 0.05) {
          fish.y += Math.random() < 0.5 ? -1 : 1;
        }

        const fishPixelX = fish.x * C;
        const waveAtFish = getWaveY(fishPixelX, wavePhase);
        const minFishSubY = Math.ceil((waveAtFish + 16) / C);

        if (fish.y < minFishSubY) {
          fish.y = minFishSubY;
        }
        if (fish.y > maxSubY) {
          fish.y = maxSubY;
        }

        if (fish.dx === 1 && fish.x > maxSubX) {
          fish.x = -4;
          fish.y = Math.floor(minFishSubY + Math.random() * Math.max(6, maxSubY - minFishSubY));
        } else if (fish.dx === -1 && fish.x < -4) {
          fish.x = maxSubX;
          fish.y = Math.floor(minFishSubY + Math.random() * Math.max(6, maxSubY - minFishSubY));
        }
      }

      ctx.fillStyle = fish.color;
      const shape = fish.dx === 1 ? FISH_SHAPE_RIGHT : FISH_SHAPE_LEFT;
      shape.forEach(pt => {
        const fx = (fish.x + pt.c) * C;
        const fy = (fish.y + pt.r) * C;
        if (fx >= -C && fx <= width && fy >= 0 && fy <= height) {
          ctx.fillRect(fx, fy, C, C);
        }
      });
    });

    requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize, { passive: true });

  resize();
  requestAnimationFrame(render);
})();

/* ── 7. Navbar scroll effect ──────────────────────── */
(function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const links = nav.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);

    // Active section highlighting
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(s => {
      const top = s.offsetTop - 100;
      if (window.scrollY >= top) current = s.id;
    });
    links.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === `#${current}`);
    });
  }, { passive: true });
})();

/* ── 8. Scroll reveal ─────────────────────────────── */
(function initReveal() {
  const els = document.querySelectorAll(
    '.feat-card, .step-row, .plan-card, .hero-editor-container, .pixel-chars-section, .mascot-section'
  );
  els.forEach(el => el.classList.add('sr'));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      const siblings = Array.from(e.target.parentElement.children);
      const delay = siblings.indexOf(e.target) * 100;
      setTimeout(() => e.target.classList.add('in'), delay);
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
})();

/* ── 9. Plans pixel decoration animation ─────────── */
(function animatePlansPixels() {
  // Make the plan cards have a subtle pixel shimmer on hover
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s, box-shadow 0.1s';
    });
  });

  // Animate the plan signal bars
  document.querySelectorAll('.plan-card').forEach((card, i) => {
    const bars = card.querySelectorAll('.bar');
    bars.forEach((bar, j) => {
      if (!bar.classList.contains('bar-on')) return;
      setInterval(() => {
        bar.style.opacity = (0.6 + Math.random() * 0.4).toString();
      }, 800 + j * 200 + i * 100);
    });
  });
})();

/* ── 10. Chat bubble typing animation ─────────────── */
(function initChatTyping() {
  const bubble = document.querySelector('.chat-ai-bubble .chat-bubble-content p:last-of-type');
  if (!bubble) return;

  const fullText = bubble.textContent.trim();
  bubble.textContent = '';
  let i = 0;
  let started = false;

  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !started) {
      started = true;
      function type() {
        if (i < fullText.length) {
          bubble.textContent += fullText[i++];
          setTimeout(type, 28 + Math.random() * 30);
        }
      }
      setTimeout(type, 400);
    }
  }, { threshold: 0.5 });

  const container = document.getElementById('step-chat');
  if (container) io.observe(container);
})();

/* ── 11. Diff lines animated reveal ──────────────── */
(function initDiffReveal() {
  const diff = document.getElementById('mockup-diff');
  if (!diff) return;

  const lines = diff.querySelectorAll('.diff-line');
  lines.forEach(line => {
    line.style.opacity = '0';
    line.style.transform = 'translateX(-8px)';
    line.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  });

  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    lines.forEach((line, i) => {
      setTimeout(() => {
        line.style.opacity = '1';
        line.style.transform = 'translateX(0)';
      }, i * 120);
    });
    io.unobserve(diff);
  }, { threshold: 0.5 });

  io.observe(diff);
})();

/* ── 12. Pixel cursor glow on hero ───────────────── */
(function initPixelCursor() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hero.style.setProperty('--cx', `${x}px`);
    hero.style.setProperty('--cy', `${y}px`);
  });
})();

/* ── 13. Zigzag divider draw ─────────────────────── */
(function initZigzags() {
  // Already handled by CSS background-image SVG
  // Add subtle animation
  document.querySelectorAll('.step-zigzag').forEach((el, i) => {
    let pos = 0;
    function animate() {
      pos += 0.3;
      el.style.backgroundPositionX = `${pos}px`;
      requestAnimationFrame(animate);
    }
    animate();
  });
})();
