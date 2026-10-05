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
  const COLORS = ['#7c3aed','#ec4899','#06b6d4','#f59e0b'];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / FONT_SIZE);
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

      const char  = CHARS[Math.floor(Math.random() * CHARS.length)];
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
      " :MMW .dXMMMMMKl.   :MMW         ,MMM     XMMc     .dXMMMMMKl.   :MMW   .xMM0. ",
      " :MMW,WMN;   .cWMX  :MMW         ,MMM     XMMc    ,WMN;   .cWMX  :MMW  ,0MMK;  ",
      " :MMWOMMNKKKKKWMM:  :MMW         ,MMM     XMMc    OMMN.   ....   :MMW.dWMX:    ",
      " :MMWlXMMWNKOo..    :MMW         ,MMM     XMMc    OMMN.          :MMWXMMWKc    ",
      " :MMW:MMc.          :MMW         ,MMM     XMMc    lMMN.   ....   :MMW 'kMMNd.  ",
      " :MMW               :MMW         .MMMc   :MMMc     :XMMNKKNMN.   :MMW   :XMMWc ",
      " :MMW               :MMW          lWMMWNWMWMMc       .;clc:'.    :MMW    .xMMO ",
      " :MMW               :MMW...         ,clc, ,::.                   .::;     .cl: ",
      " .::;               .:::::;                                                    "
    ],
    mobileLogoText: [
      " :MMo.o0XNX0o.   :MMo  lMMo  kMM;   .o0XNX0o.   :MMo.xKKc ",
      " :MMo'   'dMMl   :MMo  lMMo  kMM;  oMMd'  dMMl  :MMWXMMW  ",
      " :MM00000NWN'    :MMo  lMMo  kMM;  MMM00000NWN  :MMW.dWMX ",
      " :MMo            :MMo  lMMo  kMM;  xMMd         :MMW 'kMM ",
      " :MMo            :WWK   c0WMMXxNW   ,xKWMMWKo   :WWK   ,x ",
      " .:::            .:::     'clc'       .:::      .:::      "
    ],
    fontSize: 15,
    fontFamily: "'Space Mono', 'SF Mono', monospace",
    fontWeight: 'bold',
    textColor: '#8B5CF6',
    backgroundColor: '#1D0245',
    emptySlotChar: '.',
    emptySlotColor: '#4C1D95',
    ejectedPieceColors: ['#EC4899', '#06B6D4', '#F59E0B', '#C084FC'],
    ejectionIntervalMs: 650,
    ejectedPieceBaseSpeed: 2.8,
    ejectedPieceDamping: 0.982,
    maxEjectedPieces: 25,
    initialEjectedPiecesCount: 12,
    robotChar: '@',
    robotColor: '#FFFBEB',
    robotMoveInterval: 3,
    robotPickupDelay: 6,
    robotPlaceDelay: 6,
    logicalCharWidth: 88,
    logicalCharHeight: 16,
    mobileLogicalCharWidth: 60,
    mobileLogicalCharHeight: 14
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
      .map(s => ({ slot: s, dist: (s.canvasX - clickX)**2 + (s.canvasY - clickY)**2 }))
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
    span.style.left   = `${Math.random() * 100}%`;
    span.style.top    = `${6 + Math.random() * 88}%`;
    span.style.setProperty('--dur',   `${7 + Math.random() * 9}s`);
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

/* ── 4. Pixel character sprites ───────────────────── */
// Each character is a 2D pixel grid painted onto canvas
// Palette matches Jules: pink body (#ec4899), yellow outfit (#f59e0b), cyan accents (#06b6d4)

const PIX = 8; // pixel size

function paintPixels(ctx, grid, x0, y0, palette) {
  grid.forEach((row, ry) => {
    row.forEach((col, cx) => {
      if (col === 0) return;
      ctx.fillStyle = palette[col - 1];
      ctx.fillRect(x0 + cx * PIX, y0 + ry * PIX, PIX, PIX);
    });
  });
}

// Pixel art definitions (col index = palette index + 1, 0 = transparent)
// 1=pink(body), 2=yellow(outfit), 3=cyan(accent), 4=purple(dark), 5=white

const CODER_SPRITE = [
  [0,0,1,1,1,0,0,0],
  [0,1,1,1,1,1,0,0],
  [0,1,5,1,5,1,0,0],
  [0,1,1,1,1,1,0,0],
  [0,0,2,2,2,0,0,0],
  [0,2,2,2,2,2,0,0],
  [0,2,2,2,2,2,0,0],
  [0,0,1,0,1,0,0,0],
  [0,0,1,0,1,0,0,0],
];

const DESK_SPRITE = [
  [3,3,3,3,3,3,3,3],
  [3,4,4,4,4,4,4,3],
  [3,4,3,4,4,3,4,3],
  [3,4,4,4,4,4,4,3],
  [3,3,3,3,3,3,3,3],
];

const CYCLIST_BODY = [
  [0,0,1,1,1,0],
  [0,1,1,1,1,1],
  [0,1,5,1,5,1],
  [0,1,1,1,1,1],
  [0,0,2,2,0,0],
  [0,2,2,0,1,0],
  [0,0,2,0,1,0],
];

const READER_SPRITE = [
  [0,1,1,1,0],
  [1,1,5,1,1],
  [0,1,1,1,0],
  [0,2,2,2,0],
  [2,2,2,2,2],
  [0,3,0,3,0],
  [0,3,0,3,0],
];

const BOOK_SPRITE = [
  [3,3,3,3],
  [3,5,5,3],
  [3,5,5,3],
  [3,5,5,3],
  [3,3,3,3],
];

const PONG_PLAYER = [
  [0,1,1,1,0],
  [1,1,5,1,1],
  [0,1,1,1,0],
  [0,2,2,2,0],
  [2,2,2,2,2],
  [0,1,0,1,0],
];

const PING_PONG_TABLE = [
  [3,3,3,3,3,3,3,3,3,3,3,3],
  [4,4,4,4,4,4,4,4,4,4,4,4],
];

// PALETTE
const CHAR_PAL = ['#ec4899','#f59e0b','#06b6d4','#2d1b6e','#f0e6ff'];

(function drawPixelChars() {
  // ── Coder ──
  const coder = document.getElementById('char-coder');
  if (coder) {
    const ctx = coder.getContext('2d');
    ctx.clearRect(0, 0, coder.width, coder.height);
    paintPixels(ctx, CODER_SPRITE, 16, 0, CHAR_PAL);
    paintPixels(ctx, DESK_SPRITE, 4, PIX * 9, CHAR_PAL);

    // Animate: hands type (bob up/down)
    let t = 0;
    function animateCoder() {
      ctx.clearRect(0, 0, coder.width, coder.height);
      const bob = Math.sin(t) > 0 ? 0 : PIX;
      paintPixels(ctx, CODER_SPRITE, 16, bob, CHAR_PAL);
      paintPixels(ctx, DESK_SPRITE, 4, PIX * 9, CHAR_PAL);
      // Cursor blink on screen
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(4 + PIX * 5, PIX * 9 + PIX * 2, PIX, PIX);
      }
      t += 0.12;
      requestAnimationFrame(animateCoder);
    }
    animateCoder();
  }

  // ── Cyclist ──
  const cyclist = document.getElementById('char-cyclist');
  if (cyclist) {
    const ctx = cyclist.getContext('2d');
    let wx = 0;

    function drawWheel(ctx, cx, cy, r, rot) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = PIX;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      // Spokes
      for (let i = 0; i < 4; i++) {
        const angle = rot + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        ctx.stroke();
      }
    }

    let rot = 0;
    function animateCyclist() {
      ctx.clearRect(0, 0, cyclist.width, cyclist.height);
      paintPixels(ctx, CYCLIST_BODY, 40, 8, CHAR_PAL);
      // Frame
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(44, 60); ctx.lineTo(80, 60); ctx.lineTo(100, 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(80, 60); ctx.lineTo(64, 44); ctx.lineTo(100, 44); ctx.stroke();
      // Wheels
      drawWheel(ctx, 44, 76, 20, rot);
      drawWheel(ctx, 100, 76, 20, rot);
      rot += 0.08;
      requestAnimationFrame(animateCyclist);
    }
    animateCyclist();
  }

  // ── Reader ──
  const reader = document.getElementById('char-reader');
  if (reader) {
    const ctx = reader.getContext('2d');
    let page = 0;

    function animateReader() {
      ctx.clearRect(0, 0, reader.width, reader.height);
      paintPixels(ctx, READER_SPRITE, 32, 0, CHAR_PAL);
      paintPixels(ctx, BOOK_SPRITE, 4, 28, CHAR_PAL);
      // Page turn animation
      if (Math.floor(page) % 2 === 0) {
        ctx.fillStyle = '#f0e6ff';
        ctx.fillRect(4, 28 + PIX, PIX, PIX * 3);
      }
      page += 0.03;
      requestAnimationFrame(animateReader);
    }
    animateReader();
  }

  // ── Ping Pong ──
  const pong = document.getElementById('char-pong');
  if (pong) {
    const ctx = pong.getContext('2d');
    let ballX = 60, ballY = 50, vx = 1.5, vy = -1.2;
    const paddleY = 40;

    function animatePong() {
      ctx.clearRect(0, 0, pong.width, pong.height);
      paintPixels(ctx, PONG_PLAYER, 16, 0, CHAR_PAL);
      paintPixels(ctx, PING_PONG_TABLE, 0, 68, CHAR_PAL);

      // Ball
      ballX += vx; ballY += vy;
      if (ballX < 10 || ballX > 130) vx = -vx;
      if (ballY < 10 || ballY > 60) vy = -vy;

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ballX, ballY, PIX, PIX);

      // Paddle/bat
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(pong.width - 20, paddleY, PIX / 2, 24);

      requestAnimationFrame(animatePong);
    }
    animatePong();
  }
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
      'feat-deps':   { x: -5, y: 3 },
      'feat-secret': { x: 5,  y: -4 },
      'feat-mcp':    { x: 5,  y: 3 }
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
    const W = energyCanvas.width, H = energyCanvas.height;

    // Circuit conduits on the right half of squid.png (proportional coordinates in 280x280)
    const sparks = Array.from({ length: 9 }, () => ({
      x: 145 + Math.random() * 60,
      y: 40 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      color: Math.random() > 0.5 ? '#06b6d4' : '#f59e0b',
      life: Math.random() * 30,
      maxLife: 30 + Math.random() * 40,
      size: 2 + Math.random() * 2
    }));

    let gearAngle = 0;

    function drawSparks() {
      ctx.clearRect(0, 0, W, H);

      // Rotating subtle aura around the pink gear at (170, 134)
      gearAngle += 0.025;
      ctx.save();
      ctx.translate(170, 134);
      ctx.rotate(gearAngle);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-12, -12, 24, 24);
      ctx.restore();

      // Cybernetic spark nodes
      sparks.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        // Keep inside right half of octopus
        if (s.x < 142) { s.x = 142; s.vx *= -1; }
        if (s.x > 215) { s.x = 215; s.vx *= -1; }
        if (s.y < 35)  { s.y = 35;  s.vy *= -1; }
        if (s.y > 235) { s.y = 235; s.vy *= -1; }

        if (s.life > s.maxLife) {
          s.x = 145 + Math.random() * 60;
          s.y = 40 + Math.random() * 180;
          s.life = 0;
        }

        const alpha = Math.sin((s.life / s.maxLife) * Math.PI) * 0.85;
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

/* ── 6. Dot-grid background for mascot section ────── */
(function initDotGrid() {
  const canvas = document.getElementById('dot-grid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    const section = canvas.parentElement;
    canvas.width  = section.offsetWidth;
    canvas.height = section.offsetHeight;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const STEP = 24;
    const cols = Math.ceil(canvas.width / STEP);
    const rows = Math.ceil(canvas.height / STEP);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Vary dot size for depth
        const size = Math.random() < 0.05 ? 3 : Math.random() < 0.15 ? 2 : 1;
        const alpha = 0.08 + Math.random() * 0.2;
        ctx.fillStyle = `rgba(124, 58, 237, ${alpha})`;
        ctx.fillRect(c * STEP + STEP/2 - size/2, r * STEP + STEP/2 - size/2, size, size);
      }
    }
  }

  resize();
  draw();

  // Animate: redraw slowly
  let t = 0;
  function animate() {
    t++;
    if (t % 20 === 0) draw(); // Redraw every 20 frames for twinkling
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('resize', () => { resize(); draw(); }, { passive: true });
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
