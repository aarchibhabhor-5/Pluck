/* =====================================================
   PLUCK — Custom Cyberpunk Dialog & Modal Engine
   Replaces native browser "localhost:4000 says" alert & confirm
   with Pluck-branded "Pluck says:" 3D modals
   ===================================================== */

(function initPluckDialogEngine(global) {
  let activeResolve = null;

  const DIALOG_CSS = `
    .pluck-dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.82);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000000;
      padding: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pluck-dialog-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .pluck-dialog-box {
      background: linear-gradient(180deg, #131826 0%, #0a0d17 100%);
      border: 1px solid #7c3aed;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(124, 58, 237, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      width: 100%;
      max-width: 460px;
      overflow: hidden;
      transform: translateY(16px) scale(0.96);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }
    .pluck-dialog-overlay.open .pluck-dialog-box {
      transform: translateY(0) scale(1);
    }
    .pluck-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: rgba(18, 23, 38, 0.85);
      border-bottom: 1px solid rgba(139, 92, 246, 0.28);
    }
    .pluck-dialog-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pluck-dialog-squid {
      width: 24px;
      height: 24px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.7));
    }
    .pluck-dialog-title {
      font-family: 'Press Start 2P', monospace, sans-serif;
      font-size: 12px;
      color: #38bdf8;
      letter-spacing: 0.5px;
      text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
    }
    .pluck-dialog-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      line-height: 1;
      transition: all 0.15s ease;
    }
    .pluck-dialog-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
    .pluck-dialog-body {
      padding: 22px 20px;
      font-family: 'Space Mono', monospace, sans-serif;
      font-size: 13px;
      color: #e2e8f0;
      line-height: 1.6;
      white-space: pre-line;
      word-break: break-word;
    }
    .pluck-dialog-footer {
      padding: 14px 20px 18px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      background: rgba(10, 13, 22, 0.75);
      border-top: 1px solid rgba(139, 92, 246, 0.18);
    }
    .btn-pluck-dialog-cancel {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 18px;
      background: linear-gradient(180deg, #1e2538 0%, #121624 100%);
      border: 1px solid #475569;
      border-bottom: 3px solid #090d16;
      border-radius: 5px;
      color: #94a3b8;
      font-family: 'Space Mono', monospace, sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-pluck-dialog-cancel:hover {
      border-color: #cbd5e1;
      color: #ffffff;
      transform: translateY(-1px);
    }
    .btn-pluck-dialog-cancel:active {
      transform: translateY(2px);
      border-bottom-width: 1px;
    }
    .btn-pluck-dialog-confirm {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 22px;
      background: linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%);
      border: 1px solid #38bdf8;
      border-bottom: 3px solid #0369a1;
      border-radius: 5px;
      color: #ffffff;
      font-family: 'Space Mono', monospace, sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 3px 10px rgba(14, 165, 233, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25);
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-pluck-dialog-confirm:hover {
      border-color: #7dd3fc;
      box-shadow: 0 5px 16px rgba(14, 165, 233, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.35);
      transform: translateY(-1px);
    }
    .btn-pluck-dialog-confirm:active {
      transform: translateY(2px);
      border-bottom-width: 1px;
    }
    .btn-pluck-dialog-confirm.danger {
      background: linear-gradient(180deg, #f43f5e 0%, #e11d48 100%);
      border: 1px solid #fb7185;
      border-bottom: 3px solid #9f1239;
      box-shadow: 0 3px 12px rgba(244, 63, 94, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
    .btn-pluck-dialog-confirm.danger:hover {
      border-color: #fda4af;
      box-shadow: 0 5px 18px rgba(244, 63, 94, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.35);
      transform: translateY(-1px);
    }
  `;

  function ensureDialogElements() {
    if (!document.getElementById('pluck-dialog-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'pluck-dialog-styles';
      styleEl.textContent = DIALOG_CSS;
      document.head.appendChild(styleEl);
    }

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

      cancelBtn.style.display = 'none'; // Alert only has confirmation button

      okBtn.textContent = options.confirmText || 'OK';
      okBtn.className = 'btn-pluck-dialog-confirm';

      window.addEventListener('keydown', overlay._handleKey);
      overlay.classList.add('open');
      setTimeout(() => okBtn.focus(), 60);
    });
  }

  // Expose to window
  global.pluckConfirm = pluckConfirm;
  global.pluckAlert = pluckAlert;

  // Intercept native window.alert so all popups display "Pluck says:"
  global.alert = function (msg) {
    return pluckAlert(msg);
  };

  // Provide a safe async-compatible bridge for legacy confirm calls
  global.pluckNativeConfirm = global.confirm;
})(window);
