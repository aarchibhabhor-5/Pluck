'use strict';

// ── 0. Immediate Session Purge on Landing Page ───────────
(function enforceLandingSignOut() {
  function purge() {
    const token = localStorage.getItem('pluck_token');
    const user = localStorage.getItem('pluck_user');
    const hasCookie = document.cookie && document.cookie.includes('pluck_session=');

    if (token || user || hasCookie) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        fetch('/api/auth/logout', { method: 'POST', headers: headers, keepalive: true }).catch(() => { });
      } catch (e) { }

      try {
        localStorage.removeItem('pluck_user');
        localStorage.removeItem('pluck_token');
        localStorage.removeItem('pluck_user_snippets');
        localStorage.removeItem('pluck_active_snippet');
        sessionStorage.removeItem('pluck_active_snippet');
        sessionStorage.clear();
        document.cookie = 'pluck_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        document.cookie = 'pluck_session=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
        document.cookie = 'JSESSIONID=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      } catch (e) { }
    }
  }
  purge();
  window.addEventListener('pageshow', purge);
})();

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
    ctx.fillStyle = 'rgba(10, 10, 10, 0.07)';
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
    textColor: '#4ade80',
    backgroundColor: '#121212',
    emptySlotChar: '.',
    emptySlotColor: '#242429',
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
  const mascotCenter = document.getElementById('mascot-center') || document.getElementById('mascot-frame');

  if (pupil) {
    let currentX = 0, currentY = 0;
    let targetX = 0, targetY = 0;
    let currentRot = 0;
    let targetRot = 0;
    let hoveredCard = null;

    // Track mouse everywhere across the screen when mascot is in view
    window.addEventListener('mousemove', (e) => {
      if (hoveredCard) return; // Snapped to card

      const rect = pupil.getBoundingClientRect();
      // Skip calculations if mascot section is scrolled far off-screen
      if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;

      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height / 2;

      const dx = e.clientX - eyeCenterX;
      const dy = e.clientY - eyeCenterY;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        const angle = Math.atan2(dy, dx);
        const maxOffset = 8.0; // Visibly distinct tracking within socket
        const factor = Math.min(dist / 380, 1);
        targetX = Math.cos(angle) * maxOffset * factor;
        targetY = Math.sin(angle) * maxOffset * factor;
        // Pupil rotates dynamically to point in the direction of cursor
        targetRot = (angle * 180 / Math.PI);
      }
    }, { passive: true });

    // When cursor leaves the window or document, gently return to center
    document.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
      targetRot = 0;
    });

    // Specific card hover snaps with aligned gaze rotation
    const cardTargets = {
      'feat-search': { x: -7.5, y: -5.5, rot: -135 },
      'feat-deps': { x: -7.5, y: 5.0, rot: 145 },
      'feat-secret': { x: 7.5, y: -5.5, rot: -45 },
      'feat-team': { x: 7.5, y: 5.0, rot: 35 }
    };

    Object.entries(cardTargets).forEach(([id, offset]) => {
      const card = document.getElementById(id);
      if (card) {
        card.addEventListener('mouseenter', () => {
          hoveredCard = id;
          targetX = offset.x;
          targetY = offset.y;
          targetRot = offset.rot;
        });
        card.addEventListener('mouseleave', () => {
          if (hoveredCard === id) {
            hoveredCard = null;
          }
        });
      }
    });

    // Extra sensitive tracking & rotation when hovering directly on mascot
    if (mascotCenter) {
      mascotCenter.addEventListener('mousemove', (e) => {
        const rect = pupil.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;
        const dx = e.clientX - eyeCenterX;
        const dy = e.clientY - eyeCenterY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          const angle = Math.atan2(dy, dx);
          targetX = Math.cos(angle) * 8.5;
          targetY = Math.sin(angle) * 8.5;
          targetRot = (angle * 180 / Math.PI);
        }
      });
    }

    function updatePupil() {
      // Smooth lerp for position
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;

      // Shortest-arc interpolation for rotation
      let diffRot = (targetRot - currentRot) % 360;
      if (diffRot > 180) diffRot -= 360;
      if (diffRot < -180) diffRot += 360;
      currentRot += diffRot * 0.18;

      // Force inline style with !important so CSS animations never override it
      pupil.style.setProperty(
        'transform',
        `translate(calc(-50% + ${currentX.toFixed(2)}px), calc(-50% + ${currentY.toFixed(2)}px)) rotate(${currentRot.toFixed(1)}deg)`,
        'important'
      );
      requestAnimationFrame(updatePupil);
    }
    updatePupil();
  }

  // Micro electrical impulses distributed evenly across the entire mechanical half
  if (energyCanvas) {
    const ctx = energyCanvas.getContext('2d');
    const W = 410, H = 410;
    energyCanvas.width = W;
    energyCanvas.height = H;

    const mascotImg = document.getElementById('mascot-octopus');

    // 5 balanced zones ensuring uniform particle distribution throughout the entire mechanical half:
    // Zone 0: Upper Brain & Cortex (Y: 20 to 110)
    // Zone 1: Mid Circuit traces & microchips (Y: 110 to 175)
    // Zone 2: Gear core & central power bus (Y: 175 to 240)
    // Zone 3: Lower Trunk & middle descending tentacle (Y: 240 to 375, X < 305)
    // Zone 4: Right sweeping & curling mechanical tentacle (X >= 295, Y >= 210)
    const zones = [[], [], [], [], []];
    const interiorBitmap = new Uint8Array(W * H);

    function initEnergyField() {
      if (!mascotImg) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = W;
      tempCanvas.height = H;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(mascotImg, 0, 0, W, H);

      let imgData = null;
      try {
        imgData = tempCtx.getImageData(0, 0, W, H).data;
      } catch (e) {
        imgData = null;
      }

      function checkRawPixel(x, y) {
        if (!imgData) return false;
        if (x < 208 || x > 376 || y < 20 || y > 378) return false;
        const idx = (y * W + x) * 4;
        const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
        if (a < 60) return false;
        // Dark outer boundary
        if (r < 22 && g < 18 && b < 26) return false;
        // Solid purple outer skin of octopus body
        if (r > 85 && r < 180 && g > 25 && g < 100 && b > 175) return false;
        // Dark violet contour band
        if (r > 38 && r < 85 && g > 12 && g < 45 && b > 80 && b < 165) return false;
        // Eye pupil socket
        if (x < 218 && r > 230 && g > 230 && b > 230) return false;
        return true;
      }

      // Populate safe interior coordinates with 3px buffer from skin/border
      if (imgData) {
        for (let y = 20; y <= 378; y++) {
          for (let x = 208; x <= 376; x++) {
            if (!checkRawPixel(x, y)) continue;

            let safe = true;
            for (let d = -3; d <= 3; d += 3) {
              if (!checkRawPixel(x + d, y) || !checkRawPixel(x, y + d)) {
                safe = false;
                break;
              }
            }
            if (!safe) continue;

            interiorBitmap[y * W + x] = 1;

            if (y < 112) {
              zones[0].push({ x, y }); // Zone 0: Brain
            } else if (y < 178 && x < 305) {
              zones[1].push({ x, y }); // Zone 1: Mid circuits
            } else if (y < 240 && x < 305) {
              zones[2].push({ x, y }); // Zone 2: Gear core
            } else if (x < 305) {
              zones[3].push({ x, y }); // Zone 3: Lower trunk & center tentacle
            } else {
              zones[4].push({ x, y }); // Zone 4: Right curling tentacle
            }
          }
        }
      }

      // Fallback pre-calculated seeds if image data unavailable
      const fallbackSeeds = [
        [{ x: 238, y: 55 }, { x: 255, y: 75 }, { x: 228, y: 92 }],
        [{ x: 225, y: 135 }, { x: 248, y: 150 }, { x: 235, y: 165 }],
        [{ x: 245, y: 195 }, { x: 235, y: 215 }, { x: 255, y: 225 }],
        [{ x: 232, y: 260 }, { x: 242, y: 295 }, { x: 230, y: 340 }],
        [{ x: 338, y: 265 }, { x: 350, y: 275 }, { x: 320, y: 305 }]
      ];
      for (let z = 0; z < 5; z++) {
        if (zones[z].length === 0) {
          zones[z] = fallbackSeeds[z];
          fallbackSeeds[z].forEach(p => { interiorBitmap[p.y * W + p.x] = 1; });
        }
      }

      startSparksEngine();
    }

    function isInside(x, y) {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
      return interiorBitmap[iy * W + ix] === 1;
    }

    function getRandomZonePos(zoneIdx) {
      const pts = zones[zoneIdx % 5];
      if (pts && pts.length > 0) {
        const pt = pts[Math.floor(Math.random() * pts.length)];
        return { x: pt.x, y: pt.y };
      }
      return { x: 245, y: 190 };
    }

    // 35 total particles evenly balanced: exactly 7 particles in each of the 5 zones
    const BASE_PARTICLES_PER_ZONE = 7;
    const TOTAL_BASE = BASE_PARTICLES_PER_ZONE * 5;
    let sparks = [];

    const sparkPalette = [
      '#00f0ff', // electric cyan
      '#38bdf8', // sky cyan
      '#fbbf24', // golden circuit amber
      '#f59e0b', // warm amber
      '#ec4899', // neon pink
      '#f43f5e', // deep pink
      '#a855f7'  // quantum purple
    ];

    function createSpark(zoneIdx, isBurst = false) {
      const pos = getRandomZonePos(zoneIdx);
      return {
        zone: zoneIdx % 5,
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * (isBurst ? 1.2 : 0.6),
        vy: (Math.random() - 0.5) * (isBurst ? 1.2 : 0.6),
        color: sparkPalette[Math.floor(Math.random() * sparkPalette.length)],
        life: isBurst ? 0 : Math.floor(Math.random() * 45),
        maxLife: isBurst ? 35 + Math.floor(Math.random() * 25) : 55 + Math.floor(Math.random() * 55),
        size: 2.2 + Math.random() * 1.6
      };
    }

    function startSparksEngine() {
      sparks = [];
      for (let z = 0; z < 5; z++) {
        for (let k = 0; k < BASE_PARTICLES_PER_ZONE; k++) {
          sparks.push(createSpark(z, false));
        }
      }

      function drawSparks() {
        ctx.clearRect(0, 0, W, H);

        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];

          // Burst cleanup
          if (sparks.length > TOTAL_BASE && s.life >= s.maxLife) {
            sparks.splice(i, 1);
            continue;
          }

          const nextX = s.x + s.vx;
          const nextY = s.y + s.vy;

          if (isInside(nextX, s.y)) {
            s.x = nextX;
          } else {
            s.vx *= -1;
          }

          if (isInside(s.x, nextY)) {
            s.y = nextY;
          } else {
            s.vy *= -1;
          }

          s.life++;

          // Respawn in assigned zone to guarantee continuous uniform coverage across all sections
          if (!isInside(s.x, s.y) || s.life > s.maxLife) {
            const fresh = createSpark(s.zone, false);
            s.x = fresh.x;
            s.y = fresh.y;
            s.vx = fresh.vx;
            s.vy = fresh.vy;
            s.color = fresh.color;
            s.life = 0;
            s.maxLife = fresh.maxLife;
            s.size = fresh.size;
          }

          const progress = s.life / s.maxLife;
          const alpha = Math.sin(progress * Math.PI) * 0.95;

          ctx.shadowColor = s.color;
          ctx.shadowBlur = 4;
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.max(0.3, Math.min(1, alpha));
          ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.size), Math.round(s.size));
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1.0;
        requestAnimationFrame(drawSparks);
      }
      drawSparks();
    }

    // Initialize when image is available
    if (mascotImg && mascotImg.complete && mascotImg.naturalWidth > 0) {
      initEnergyField();
    } else if (mascotImg) {
      mascotImg.addEventListener('load', initEnergyField, { once: true });
    } else {
      setTimeout(initEnergyField, 200);
    }

    // Surge sparks along internal mechanic circuits/tentacles when unfolding (evenly in all zones)
    window.triggerMascotTentacleBurst = function () {
      for (let z = 0; z < 5; z++) {
        for (let b = 0; b < 3; b++) {
          sparks.push(createSpark(z, true));
        }
      }
    };
  }
})();

/* ── 5.1 Scroll-Based Characters, Octopus & Feature Cards Zoom Sequence ────── */
(function initMascotScrollSequence() {
  const charsSection = document.getElementById('pixel-chars-section');
  const section = document.getElementById('features');
  const mascotFrame = document.getElementById('mascot-frame');
  const cards = document.querySelectorAll('.feat-card');
  if (!section || !mascotFrame || cards.length === 0) return;

  // Prepare initial hidden state for both sections (in-place scale 0.7)
  section.classList.add('scroll-anim-prep');
  if (charsSection) {
    charsSection.classList.add('chars-anim-prep');
  }

  let animState = 'none'; // 'none' | 'running' | 'completed'
  let timeouts = [];

  function clearAnimationTimeouts() {
    timeouts.forEach(t => clearTimeout(t));
    timeouts = [];
  }

  function startAnimation() {
    if (animState === 'running' || animState === 'completed') return;
    animState = 'running';
    clearAnimationTimeouts();

    // Stage 1: First, these 4 character components zoom out & appear on their respective places!
    if (charsSection) {
      charsSection.classList.remove('chars-anim-prep', 'chars-anim-completed');
      charsSection.classList.add('chars-anim-in');
    }

    // Stage 2: Then, the octopus appears with zoom in animation at center (at 750ms)
    timeouts.push(setTimeout(() => {
      section.classList.remove('scroll-anim-prep', 'state-unfold-tentacles', 'state-cards-in', 'state-completed');
      section.classList.add('state-zoom-in');
    }, 750));

    // Stage 2b: Octopus unfolds its presence / tentacles (at 1300ms)
    timeouts.push(setTimeout(() => {
      section.classList.add('state-unfold-tentacles');

      if (typeof window.triggerMascotTentacleBurst === 'function') {
        window.triggerMascotTentacleBurst();
      }
    }, 1300));

    // Stage 3: Then, those 4 feature cards around the octopus smoothly zoom in on their respective places (at 1800ms)
    timeouts.push(setTimeout(() => {
      section.classList.add('state-cards-in');
    }, 1800));

    // Stage 4: Settle into completed state with idle floating, bobbing & full interactivity (at 3300ms)
    timeouts.push(setTimeout(() => {
      section.classList.add('state-completed');
      if (charsSection) {
        charsSection.classList.add('chars-anim-completed');
      }
      animState = 'completed';
    }, 3300));
  }

  function resetAnimation() {
    if (animState === 'none') return;
    clearAnimationTimeouts();
    section.classList.remove('state-zoom-in', 'state-unfold-tentacles', 'state-cards-in', 'state-completed');
    section.classList.add('scroll-anim-prep');
    if (charsSection) {
      charsSection.classList.remove('chars-anim-in', 'chars-anim-completed');
      charsSection.classList.add('chars-anim-prep');
    }
    animState = 'none';
  }

  function checkScroll() {
    const triggerEl = charsSection || section;
    const rect = triggerEl.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const windowH = window.innerHeight || document.documentElement.clientHeight;

    // Trigger when user scrolls down and characters/features enter view
    if (rect.top <= windowH * 0.78 && sectionRect.bottom >= windowH * 0.15) {
      if (animState === 'none') {
        startAnimation();
      }
    } else if (rect.top > windowH * 0.95 || sectionRect.bottom < -100) {
      // User scrolled back up above characters or far below features -> reset so it replays smoothly
      if (animState !== 'none') {
        resetAnimation();
      }
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  window.addEventListener('resize', checkScroll, { passive: true });

  // Initial check on load
  checkScroll();
})();

/* ── 6. Authentic Jules PatternGrid Wave & Swimming Fish Background ────── */
(function initDotGrid() {
  const canvas = document.getElementById('dot-grid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Exact Jules 3x3 pattern matrices
  const ZE_PATTERNS = [
    [[0, 0, 0], [0, 1, 0], [0, 0, 0]], // 0: single center dot
    [[1, 0, 1], [0, 0, 0], [1, 0, 1]], // 1: 4 corner dots
    [[0, 1, 0], [1, 1, 1], [0, 1, 0]], // 2: plus sign (+)
    [[0, 0, 0], [1, 1, 1], [0, 0, 0]], // 3: horizontal line (-)
    [[0, 1, 0], [0, 1, 0], [0, 1, 0]], // 4: vertical line (|)
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]], // 5: empty space
    [[1, 0, 1], [0, 1, 0], [1, 0, 1]]  // 6: X shape
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

    // Gentle, smooth wave drift (pleasing ambient pacing)
    wavePhase += 0.0048;

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

/* ── 8. Universal Component Fade In / Fade Out Scroll Engine ─────── */
(function initScrollFadeEngine() {
  const targetSelectors = [
    // Hero Components
    '#hero-logo-canvas',
    '.hero-tagline',
    '.hero-editor-container',
    '.hero-sub',
    '.hero-ctas',
    // Features Section
    '#features .section-header',
    // How It Works / Walkthrough Components
    '#how-it-works > div:first-child',
    '.walkthrough-player-container',
    '.step-row',
    '.step-zigzag',
    // Plans / Pricing Components
    '.plans-title',
    '.plans-sub',
    '.plan-card',
    '.plans-ctas',
    '.plans-pixel-deco',
    // Footer Components
    '.footer-inner'
  ];

  const elements = document.querySelectorAll(targetSelectors.join(', '));
  if (!elements || elements.length === 0) return;

  elements.forEach(el => {
    // Appropriate fade-in/out variant
    if (el.id === 'hero-logo-canvas' || el.classList.contains('hero-logo-canvas')) {
      el.classList.add('sr-scale');
    } else if (el.classList.contains('hero-editor-container')) {
      el.classList.add('hero-editor-zoom');
    } else if (el.classList.contains('walkthrough-player-container')) {
      el.classList.add('sr-scale');
    } else {
      el.classList.add('sr');
    }

    // Auto-stagger sibling elements for a smooth cascading wave
    const parent = el.parentElement;
    if (parent) {
      if (el.classList.contains('plan-card')) {
        const cards = Array.from(parent.querySelectorAll('.plan-card'));
        const idx = cards.indexOf(el);
        if (idx > 0) el.classList.add(`sr-delay-${Math.min(idx, 4)}`);
      } else if (el.classList.contains('hero-sub')) {
        el.classList.add('sr-delay-4');
      } else if (el.classList.contains('hero-ctas')) {
        el.classList.add('sr-delay-5');
      } else if (el.classList.contains('step-row')) {
        el.classList.add('sr-delay-1');
      }
    }
  });

  // Bi-directional Fade In AND Fade Out Intersection Observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Enters viewport -> Fade In smoothly
        entry.target.classList.add('in');
      } else {
        // Leaves viewport -> Fade Out smoothly
        entry.target.classList.remove('in');
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '-10px 0px -30px 0px'
  });

  elements.forEach(el => observer.observe(el));

  // Immediate check for elements currently inside or above the viewport on load
  function checkInitialViewport() {
    const windowH = window.innerHeight || document.documentElement.clientHeight;
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < windowH * 0.95 && rect.bottom > 10) {
        el.classList.add('in');
      }
    });
  }

  // Allow initial scale(0.7) state to render first so the cinematic entrance zoom plays smoothly
  requestAnimationFrame(() => {
    setTimeout(checkInitialViewport, 60);
  });
  window.addEventListener('load', () => setTimeout(checkInitialViewport, 80));
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

/* ── 14. Interactive Step-by-Step Video Walkthrough Player ────────── */
const WALKTHROUGH_STEPS = {
  1: {
    badge: 'STEP 1 OF 7',
    title: 'Personal Vault & Tactile View Switcher',
    desc: 'Explore your real vault at /app. Toggle between the elevated 3D Grid View and the compact List View with inline code previews, language filters, and AST dependencies.',
    link: 'app.html',
    linkText: 'Explore Real Vault Dashboard →',
    timestamp: 0
  },
  2: {
    badge: 'STEP 2 OF 7',
    title: '⌘K Semantic Intent & Vector Search',
    desc: 'Trigger the real ⌘K command palette to search snippets in real time. Matching queries like "debounce" instantly filter results with direct keyboard navigation.',
    link: 'app.html',
    linkText: 'Test ⌘K Search in Vault →',
    timestamp: 5
  },
  3: {
    badge: 'STEP 3 OF 7',
    title: 'Dynamic {{Variables}} & Sandbox Runner',
    desc: 'In the snippet view (/snippet.html), edit customizable {{variables}} like delay (ms) on the fly. The live code updates dynamically with auto-derived install commands.',
    link: 'snippet.html?id=use-debounce',
    linkText: 'Test Dynamic Variables →',
    timestamp: 10
  },
  4: {
    badge: 'STEP 4 OF 7',
    title: 'Universal 1-Click Code Sharing (17+ Channels)',
    desc: 'Export snippets with 1-click to Ray.so, StackBlitz, GitHub Gists, or direct communication channels like Mail, WhatsApp, LinkedIn, Reddit, and Discord.',
    link: 'snippet.html?id=use-debounce',
    linkText: 'Explore Sharing Modal →',
    timestamp: 15
  },
  5: {
    badge: 'STEP 5 OF 7',
    title: 'Snippet Studio & AST Secret Redactor',
    desc: 'Create or edit code in the Studio (/studio.html). Real-time AST scans detect hardcoded API keys and secrets, enabling 1-click redaction into process.env references.',
    link: 'studio.html',
    linkText: 'Open Studio Redactor →',
    timestamp: 22
  },
  6: {
    badge: 'STEP 6 OF 7',
    title: 'Acme Team Workspaces & RBAC',
    desc: 'Collaborate with team members (/team.html). Adjust role permissions (Owner, Admin, Editor, Viewer) via animated dropdowns and manage shared collections.',
    link: 'team.html',
    linkText: 'Manage Team Workspace →',
    timestamp: 29
  },
  7: {
    badge: 'STEP 7 OF 7',
    title: 'Zero-Trust Cyber Dialogs & Auto Sign-Out',
    desc: 'Clicking the Pluck logo squid triggers the native Pluck cyberpunk confirmation dialog and performs instant auto sign-out with zero browser history leaks.',
    link: 'app.html',
    linkText: 'Inspect System Security →',
    timestamp: 34
  }
};

let currentChapter = 1;
let isPlaying = true;
let playbackSpeed = 1.0;

function formatWalkthroughTime(sec) {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateExplainerCard(step) {
  const data = WALKTHROUGH_STEPS[step];
  if (!data) return;

  for (let i = 1; i <= 7; i++) {
    const btn = document.getElementById(`chap-btn-${i}`);
    if (btn) btn.classList.toggle('active', i === step);
  }

  const badgeEl = document.getElementById('guide-step-badge');
  const titleEl = document.getElementById('guide-step-title');
  const descEl = document.getElementById('guide-step-desc');
  const linkEl = document.getElementById('guide-step-link');

  if (badgeEl) badgeEl.textContent = data.badge;
  if (titleEl) titleEl.textContent = data.title;
  if (descEl) descEl.innerHTML = data.desc;
  if (linkEl) {
    linkEl.href = `auth.html?next=${encodeURIComponent(data.link)}`;
    linkEl.textContent = data.linkText;
  }
}

function selectChapter(step) {
  currentChapter = step;
  const data = WALKTHROUGH_STEPS[step];
  if (!data) return;

  updateExplainerCard(step);

  const video = document.getElementById('walkthrough-video-element');
  if (video) {
    video.currentTime = data.timestamp;
    if (video.paused && isPlaying) {
      video.play().catch(() => { });
    }
  }
}

function toggleWalkthroughPlay() {
  const video = document.getElementById('walkthrough-video-element');
  const btn = document.getElementById('btn-video-play');
  if (!video) return;

  if (video.paused) {
    video.play().then(() => {
      isPlaying = true;
      if (btn) btn.textContent = '⏸ Pause';
    }).catch(() => { });
  } else {
    video.pause();
    isPlaying = false;
    if (btn) btn.textContent = '▶ Play';
  }
}

function restartWalkthrough() {
  const video = document.getElementById('walkthrough-video-element');
  const btn = document.getElementById('btn-video-play');
  if (video) {
    video.currentTime = 0;
    video.play().catch(() => { });
  }
  isPlaying = true;
  if (btn) btn.textContent = '⏸ Pause';
  selectChapter(1);
}

function seekWalkthrough(e) {
  const bar = document.getElementById('walkthrough-progress-bar');
  const video = document.getElementById('walkthrough-video-element');
  if (!bar || !video || !video.duration) return;

  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  video.currentTime = ratio * video.duration;
}

function toggleSpeed() {
  const video = document.getElementById('walkthrough-video-element');
  const btn = document.getElementById('btn-speed');
  if (playbackSpeed === 1.0) playbackSpeed = 1.5;
  else if (playbackSpeed === 1.5) playbackSpeed = 2.0;
  else playbackSpeed = 1.0;

  if (video) video.playbackRate = playbackSpeed;
  if (btn) btn.textContent = `${playbackSpeed.toFixed(1)}x`;
}

function toggleFullscreen() {
  const box = document.querySelector('.walkthrough-player-box') || document.getElementById('walkthrough-screen');
  if (!box) return;
  if (!document.fullscreenElement) {
    box.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
}

// Attach video timeupdate sync
(function initWalkthroughVideoSync() {
  const video = document.getElementById('walkthrough-video-element');
  if (!video) return;

  video.addEventListener('timeupdate', () => {
    const cur = video.currentTime;
    const dur = video.duration || 56;
    const pct = Math.min(100, Math.max(0, (cur / dur) * 100));

    const fill = document.getElementById('walkthrough-progress-fill');
    const timeEl = document.getElementById('walkthrough-time');

    if (fill) fill.style.width = `${pct}%`;
    if (timeEl) timeEl.textContent = `${formatWalkthroughTime(cur)} / ${formatWalkthroughTime(dur)}`;

    // Identify active step by timestamp boundaries
    let step = 1;
    if (cur >= 34) step = 7;
    else if (cur >= 29) step = 6;
    else if (cur >= 22) step = 5;
    else if (cur >= 15) step = 4;
    else if (cur >= 10) step = 3;
    else if (cur >= 5) step = 2;
    else step = 1;

    if (step !== currentChapter) {
      currentChapter = step;
      updateExplainerCard(step);
    }
  });

  video.addEventListener('play', () => {
    isPlaying = true;
    const btn = document.getElementById('btn-video-play');
    if (btn) btn.textContent = '⏸ Pause';
  });

  video.addEventListener('pause', () => {
    isPlaying = false;
    const btn = document.getElementById('btn-video-play');
    if (btn) btn.textContent = '▶ Play';
  });
})();

/* ── 12. React Bits Dock Magnification Engine for Primary Buttons ── */
(function initDockButtons() {
  const buttons = document.querySelectorAll('.btn-solid-pixel, .btn-outline-pixel, .nav-ctas a');
  if (!buttons.length) return;

  const DISTANCE = 140;      // Proximity distance in px
  const MAX_SCALE = 1.10;     // Max magnification
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
          // Smooth cosine curve matching React Bits Dock
          const norm = (1 + Math.cos((dist / DISTANCE) * Math.PI)) / 2;
          b.targetScale = 1 + (MAX_SCALE - 1) * norm;
          // Subtle magnetic pull toward cursor (max 4px)
          b.targetTransX = (dx / DISTANCE) * 4 * norm;
          b.targetTransY = (dy / DISTANCE) * 4 * norm;
        } else {
          b.targetScale = 1;
          b.targetTransX = 0;
          b.targetTransY = 0;
        }
      }

      // Spring physics simulation
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

/* ── 12. Octopus Hero-Editor Edge Patrol ────────────────── */
(function initOctopusEdgePatrol() {
  const editor = document.getElementById('hero-editor');
  const mascot = document.getElementById('peeking-mascot');
  if (!editor || !mascot) return;

  const r = 16;              // Corner curve radius
  const inset = 2;           // Exact border contact line along card rectangle
  const baseSpeed = 8.5;     // Pixels per second (slow, calm walking pace)
  const stepDuration = 0.65; // Seconds per tentacle step (natural gait cadence)

  let currentDist = 25;      // Initial position along bottom edge
  let walkTime = 0;          // Accumulated walking time for continuous step cycle
  let isHovered = false;
  let lastTimestamp = null;
  let animFrameId = null;

  // Smoothed physics variables for organic tentacle walking
  let currentWaddle = 0;
  let currentLift = 0;
  let currentStretch = 0;

  function getPerimeterPoint(s, W, H) {
    const rArc = Math.max(1, r - inset);
    const l1 = Math.max(10, W - 2 * r); // bottom
    const l2 = rArc * (Math.PI / 2);    // bottom-right arc
    const l3 = Math.max(10, H - 2 * r); // right
    const l4 = rArc * (Math.PI / 2);    // top-right arc
    const l5 = Math.max(10, W - 2 * r); // top
    const l6 = rArc * (Math.PI / 2);    // top-left arc
    const l7 = Math.max(10, H - 2 * r); // left
    const l8 = rArc * (Math.PI / 2);    // bottom-left arc

    const P = l1 + l2 + l3 + l4 + l5 + l6 + l7 + l8;
    let rem = ((s % P) + P) % P;

    let x, y, facing, edgeLean;

    if (rem < l1) {
      // 1. Bottom edge (left to right): tentacles walk right on the bottom border
      const p = rem / l1;
      x = r + p * l1;
      y = H - inset;
      facing = 1;
      edgeLean = 0;
    } else if ((rem -= l1) < l2) {
      // 2. Bottom-Right corner
      const p = rem / l2;
      const alpha = p * (Math.PI / 2);
      x = (W - r) + rArc * Math.sin(alpha);
      y = (H - r) + rArc * Math.cos(alpha);
      facing = 1;
      edgeLean = -8 * p;
    } else if ((rem -= l2) < l3) {
      // 3. Right edge (bottom to top): tentacles climb right border
      const p = rem / l3;
      x = W - inset;
      y = (H - r) - p * l3;
      facing = 1;
      edgeLean = -8;
    } else if ((rem -= l3) < l4) {
      // 4. Top-Right corner: smoothly turns to face left
      const p = rem / l4;
      const alpha = p * (Math.PI / 2);
      x = (W - r) + rArc * Math.cos(alpha);
      y = r - rArc * Math.sin(alpha);
      facing = 1 - 2 * p;
      edgeLean = -8 * (1 - p);
    } else if ((rem -= l4) < l5) {
      // 5. Top edge (right to left): tentacles walk on top border, head upright peeking above (NEVER inverted)
      const p = rem / l5;
      x = (W - r) - p * l5;
      y = inset;
      facing = -1;
      edgeLean = 0;
    } else if ((rem -= l5) < l6) {
      // 6. Top-Left corner
      const p = rem / l6;
      const alpha = p * (Math.PI / 2);
      x = r - rArc * Math.sin(alpha);
      y = r - rArc * Math.cos(alpha);
      facing = -1;
      edgeLean = 8 * p;
    } else if ((rem -= l6) < l7) {
      // 7. Left edge (top to bottom): tentacles step down left border
      const p = rem / l7;
      x = inset;
      y = r + p * l7;
      facing = -1;
      edgeLean = 8;
    } else {
      // 8. Bottom-Left corner
      rem -= l7;
      const p = Math.min(1, rem / l8);
      const alpha = p * (Math.PI / 2);
      x = r - rArc * Math.cos(alpha);
      y = (H - r) + rArc * Math.sin(alpha);
      facing = -1 + 2 * p;
      edgeLean = 8 * (1 - p);
    }

    return { x, y, facing, edgeLean, P };
  }

  function step(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    let strideFactor = 1.0;
    let targetWaddle = 0;
    let targetLift = 0;
    let targetStretch = 0;

    if (!isHovered) {
      walkTime += dt;

      // Gait cycle calculation (0 to 1 over stepDuration)
      const stepCycle = (walkTime % stepDuration) / stepDuration;
      const stepIndex = Math.floor(walkTime / stepDuration);
      const isLeftStep = (stepIndex % 2 === 0);

      // Walking propulsion wave: plant & push vs swing
      const pushWave = Math.sin(stepCycle * Math.PI);
      strideFactor = 0.18 + 1.45 * Math.pow(pushWave, 1.7);

      // Advance distance traveled along edge border
      currentDist += baseSpeed * strideFactor * dt;

      // 1. Alternating tentacle waddle: tilts gently with each step
      const tiltDir = isLeftStep ? -1 : 1;
      targetWaddle = tiltDir * pushWave * 3.8;

      // 2. Vertical tentacle lift: body lifts away during step and lands on touchdown
      targetLift = pushWave * 2.8;

      // 3. Elastic octopus squash & stretch
      targetStretch = (pushWave - 0.45) * 0.06;
    }

    // Smoothly ease physics variables (settles gracefully on pause/resume)
    const easeRate = Math.min(1, dt * 12);
    currentWaddle += (targetWaddle - currentWaddle) * easeRate;
    currentLift += (targetLift - currentLift) * easeRate;
    currentStretch += (targetStretch - currentStretch) * easeRate;

    const W = editor.clientWidth || editor.offsetWidth || 800;
    const H = editor.clientHeight || editor.offsetHeight || 400;

    const pt = getPerimeterPoint(currentDist, W, H);
    const finalAngle = pt.edgeLean + currentWaddle;
    const scaleX = (pt.facing * (1 - currentStretch)).toFixed(3);
    const scaleY = (1 + currentStretch).toFixed(3);

    // Anchor tentacle contact point (28px, 50px) right on the border edge (pt.x, pt.y)
    const posX = pt.x - 28;
    const posY = pt.y - 50;

    mascot.style.transform = `translate3d(${posX.toFixed(2)}px, ${posY.toFixed(2)}px, 0) rotate(${finalAngle.toFixed(2)}deg) translateY(${-currentLift.toFixed(2)}px) scale(${scaleX}, ${scaleY})`;

    animFrameId = requestAnimationFrame(step);
  }

  // Interactive hover and click handlers
  mascot.addEventListener('mouseenter', () => {
    isHovered = true;
  });

  mascot.addEventListener('mouseleave', () => {
    isHovered = false;
  });

  mascot.addEventListener('click', () => {
    const img = mascot.querySelector('.peeking-octopus-img');
    if (!img) return;
    img.style.transform = 'scale(1.3) translateY(-4px)';
    setTimeout(() => {
      img.style.transform = '';
    }, 300);
  });

  // Handle dynamic resize smoothly
  if (window.ResizeObserver) {
    let lastW = editor.clientWidth;
    let lastH = editor.clientHeight;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          const oldPt = getPerimeterPoint(currentDist, lastW, lastH);
          lastW = cr.width;
          lastH = cr.height;
          const newPt = getPerimeterPoint(0, lastW, lastH);
          if (oldPt.P > 0 && newPt.P > 0) {
            currentDist = (currentDist / oldPt.P) * newPt.P;
          }
        }
      }
    });
    ro.observe(editor);
  }

  animFrameId = requestAnimationFrame(step);
})();

// ── Footer 3D Social Buttons Tooltip Controller ──────────
(function initFooterTooltips() {
  function setup() {
    const socialButtons = document.querySelectorAll('.footer-btn-3d');
    if (!socialButtons.length) return;

    socialButtons.forEach((btn) => {
      // 1. Thoroughly remove native title attribute to prevent OS default tooltip
      btn.removeAttribute('title');
      btn.querySelectorAll('*').forEach((child) => child.removeAttribute('title'));

      const tooltip = btn.querySelector('.footer-btn-tooltip');
      if (!tooltip) return;

      const show = () => {
        tooltip.classList.add('show-tooltip');
      };

      const hide = () => {
        tooltip.classList.remove('show-tooltip');
      };

      btn.addEventListener('mouseenter', show);
      btn.addEventListener('mouseleave', hide);
      btn.addEventListener('focus', show);
      btn.addEventListener('blur', hide);
      btn.addEventListener('pointerenter', show);
      btn.addEventListener('pointerleave', hide);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// ── 15. Global Auth Protection (Require Sign-In to use Pluck) ─────
(function initLandingAuthProtection() {
  function isUserAuthed() {
    try {
      return !!(localStorage.getItem('pluck_token') || localStorage.getItem('pluck_user'));
    } catch (e) {
      return false;
    }
  }

  // Auto signout when clicking logo
  function autoSignOutOnLogo(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const token = localStorage.getItem('pluck_token');

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      fetch('/api/auth/logout', { method: 'POST', headers: headers, keepalive: true }).catch(() => { });
    } catch (err) { }

    try {
      localStorage.removeItem('pluck_user');
      localStorage.removeItem('pluck_token');
      localStorage.removeItem('pluck_user_snippets');
      localStorage.removeItem('pluck_active_snippet');
      localStorage.removeItem('pluck_auth_pending');
      sessionStorage.removeItem('pluck_active_snippet');
      sessionStorage.clear();
      document.cookie = 'pluck_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      document.cookie = 'pluck_session=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      document.cookie = 'JSESSIONID=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    } catch (err) { }

    window.location.href = 'auth.html?status=signed_out';
  }
  window.autoSignOutOnLogo = autoSignOutOnLogo;

  // Intercept clicks on landing page
  document.addEventListener('click', (e) => {
    // 0. Logo click: auto signout from account
    const logoEl = e.target.closest('.nav-logo, #nav-logo-link, .nav-logo-squid, .logo-wordmark');
    if (logoEl) {
      autoSignOutOnLogo(e);
      return;
    }

    // 1. Mockup cards have no functionality - nothing happens when clicked
    const mockupCard = e.target.closest('.mockup-box, .mockup-select, .mockup-prompt-area, .step-mockup, .detect-card, .step-chat-container, .hero-editor, .chat-ai-bubble, .chat-user-bubble, .chat-action-pill');
    if (mockupCard && !e.target.closest('a, button')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // 2. Buttons & links: on index.html, never allow direct entry to protected pages without signing in
    const el = e.target.closest('a, button, [onclick]');
    if (!el) return;

    const href = el.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href === 'javascript:void(0)') {
      return;
    }
    if (href.startsWith('auth.html') || href === 'index.html' || href === '/') {
      return;
    }

    const protectedTargets = ['app.html', 'studio.html', 'snippet.html', 'team.html', 'settings.html', 'share.html'];
    for (const page of protectedTargets) {
      if (href.includes(page)) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `auth.html?next=${encodeURIComponent(href)}`;
        return false;
      }
    }
  }, true);
})();

// ── Pluck Custom Dialog & Modal Engine (Replaces "localhost:4000 says") ──
(function initPluckDialogEngine(global) {
  let activeResolve = null;

  function ensureDialogElements() {
    let overlay = document.getElementById('pluck-dialog-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pluck-dialog-overlay';
      overlay.className = 'pluck-dialog-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="pluck-dialog-box" id="pluck-dialog-box">
          <div class="pluck-dialog-header">
            <div class="pluck-dialog-brand">
              <img src="squid.png" alt="Pluck" class="pluck-dialog-squid" width="24" height="24" />
              <span class="pluck-dialog-title" id="pluck-dialog-title">Pluck says:</span>
            </div>
            <button type="button" class="pluck-dialog-close" id="pluck-dialog-x" aria-label="Close dialog">✕</button>
          </div>
          <div class="pluck-dialog-body" id="pluck-dialog-msg"></div>
          <div class="pluck-dialog-footer" id="pluck-dialog-footer">
            <button type="button" class="btn-pluck-dialog-cancel" id="pluck-dialog-cancel">Cancel</button>
            <button type="button" class="btn-pluck-dialog-confirm" id="pluck-dialog-ok">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      function closeDialog(result) {
        overlay.classList.remove('open');
        window.removeEventListener('keydown', handleKey);
        if (activeResolve) {
          const r = activeResolve;
          activeResolve = null;
          r(result);
        }
      }

      function handleKey(e) {
        if (!overlay.classList.contains('open')) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeDialog(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          closeDialog(true);
        }
      }

      const closeX = document.getElementById('pluck-dialog-x');
      const cancelBtn = document.getElementById('pluck-dialog-cancel');
      const okBtn = document.getElementById('pluck-dialog-ok');

      closeX.addEventListener('click', () => closeDialog(false));
      cancelBtn.addEventListener('click', () => closeDialog(false));
      okBtn.addEventListener('click', () => closeDialog(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog(false);
      });

      overlay._close = closeDialog;
      overlay._handleKey = handleKey;
    }
    return overlay;
  }

  function pluckConfirm(message, options = {}) {
    return new Promise((resolve) => {
      const overlay = ensureDialogElements();
      activeResolve = resolve;

      const titleEl = document.getElementById('pluck-dialog-title');
      const msgEl = document.getElementById('pluck-dialog-msg');
      const cancelBtn = document.getElementById('pluck-dialog-cancel');
      const okBtn = document.getElementById('pluck-dialog-ok');

      titleEl.textContent = options.title || 'Pluck says:';
      msgEl.textContent = message || '';

      cancelBtn.style.display = 'inline-flex';
      cancelBtn.textContent = options.cancelText || 'Cancel';

      okBtn.textContent = options.confirmText || 'OK';

      if (options.danger) {
        okBtn.className = 'btn-pluck-dialog-confirm danger';
      } else {
        okBtn.className = 'btn-pluck-dialog-confirm';
      }

      window.addEventListener('keydown', overlay._handleKey);
      overlay.classList.add('open');
      setTimeout(() => {
        if (options.focusCancel) {
          cancelBtn.focus();
        } else {
          okBtn.focus();
        }
      }, 60);
    });
  }

  function pluckAlert(message, options = {}) {
    return new Promise((resolve) => {
      const overlay = ensureDialogElements();
      activeResolve = resolve;

      const titleEl = document.getElementById('pluck-dialog-title');
      const msgEl = document.getElementById('pluck-dialog-msg');
      const cancelBtn = document.getElementById('pluck-dialog-cancel');
      const okBtn = document.getElementById('pluck-dialog-ok');

      titleEl.textContent = options.title || 'Pluck says:';
      msgEl.textContent = message || '';

      cancelBtn.style.display = 'none';

      okBtn.textContent = options.confirmText || 'OK';
      okBtn.className = 'btn-pluck-dialog-confirm';

      window.addEventListener('keydown', overlay._handleKey);
      overlay.classList.add('open');
      setTimeout(() => okBtn.focus(), 60);
    });
  }

  global.pluckConfirm = pluckConfirm;
  global.pluckAlert = pluckAlert;

  // Intercept native window.alert so all popups display "Pluck says:"
  global.alert = function (msg) {
    return pluckAlert(msg);
  };
})(window);






