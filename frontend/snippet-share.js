// ── Pluck Snippet Share Modal Controller ──────────────────────────

// Bulletproof copy helper with fallback
function safeCopyText(text, label = 'Copied to clipboard!') {
  if (typeof copySnippetText === 'function') {
    copySnippetText(text, label);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => {
        if (typeof showToast === 'function') showToast(label, 'success');
      })
      .catch(() => execCommandCopy(text, label));
    return;
  }
  execCommandCopy(text, label);
}

function execCommandCopy(text, label) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      if (typeof showToast === 'function') showToast(label, 'success');
      return;
    }
  } catch (err) {}
  if (typeof showToast === 'function') showToast('Failed to copy', 'error');
}

function getSharePayload() {
  let title = 'useDebounce Hook';
  let lang = 'TypeScript';
  let desc = 'Debounces rapidly changing values with a configurable timeout window in React 18 using useEffect cleanup.';
  let code = `import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedVal, setVal] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setVal(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedVal;
}`;
  let dep = 'npm i react@^18.3.1';

  // 1. Check activePublicSnippet (used in share.html)
  if (typeof activePublicSnippet !== 'undefined' && activePublicSnippet) {
    title = activePublicSnippet.title || title;
    lang = activePublicSnippet.language || lang;
    desc = activePublicSnippet.description || activePublicSnippet.aiSummary || desc;
    code = activePublicSnippet.code || code;
  }
  // 2. Check currentLoadedSnippet (used in snippet.html)
  else if (typeof currentLoadedSnippet !== 'undefined' && currentLoadedSnippet) {
    title = currentLoadedSnippet.title || title;
    lang = currentLoadedSnippet.language || lang;
    desc = currentLoadedSnippet.description || desc;
    code = currentLoadedSnippet.code || code;
  }

  // 3. Fallbacks from DOM
  const titleEl = document.getElementById('pub-title') || document.getElementById('detail-title');
  if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
    title = titleEl.textContent.trim();
  }

  const langEl = document.getElementById('pub-lang') || document.getElementById('detail-lang');
  if (langEl && langEl.textContent && langEl.textContent.trim()) {
    lang = langEl.textContent.trim();
  }

  const descEl = document.getElementById('pub-desc') || document.getElementById('detail-desc');
  if (descEl && descEl.textContent && descEl.textContent.trim()) {
    desc = descEl.textContent.trim();
  }

  const codeEl = document.getElementById('pub-code-display') || document.getElementById('interpolated-code-display') || document.getElementById('detail-code');
  if (codeEl && codeEl.innerText && codeEl.innerText.trim()) {
    code = codeEl.innerText;
  }

  const depEl = document.getElementById('pub-dep-cmd') || document.getElementById('dep-install-cmd');
  if (depEl && depEl.textContent && depEl.textContent.trim()) {
    dep = depEl.textContent.trim();
  }

  let url = window.location.href;
  // If sharing from vault snippet view, convert URL to public shareable URL
  if (url.includes('snippet.html')) {
    url = url.replace('snippet.html', 'share.html');
  }

  return { title, lang, desc, code, dep, url };
}

function openShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  const payload = getSharePayload();

  const sub = document.getElementById('share-modal-subtitle');
  if (sub) sub.textContent = `${payload.title} • ${payload.lang}`;

  const input = document.getElementById('share-url-input');
  if (input) input.value = payload.url;

  // Show native share pill if supported on this browser/device
  const nativeBtn = document.getElementById('share-native-btn');
  if (nativeBtn && navigator.share) {
    nativeBtn.style.display = 'inline-flex';
  }

  modal.style.display = 'flex';
  void modal.offsetWidth; // Force reflow for CSS transition
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!modal.classList.contains('open')) {
      modal.style.display = 'none';
    }
  }, 240);
}

function handleShareOverlayClick(e) {
  if (e.target && e.target.classList.contains('share-modal-overlay')) {
    closeShareModal();
  }
}

function copyShareModalLink() {
  const input = document.getElementById('share-url-input');
  const url = input ? input.value : window.location.href;
  safeCopyText(url, 'Public snippet link copied to clipboard!');

  const label = document.getElementById('share-copy-label');
  if (label) {
    const original = label.textContent;
    label.textContent = 'Copied!';
    setTimeout(() => { label.textContent = original; }, 1500);
  }
}

// ── 1. Share to Email Options ─────────────────────────────────

function shareToMailClient() {
  const { title, lang, desc, code, dep, url } = getSharePayload();
  const subject = encodeURIComponent(`[Pluck Snippet] ${title} (${lang})`);
  
  let snippetPreview = code;
  if (snippetPreview.length > 1000) {
    snippetPreview = snippetPreview.substring(0, 1000) + `\n\n... [Full code available at: ${url}]`;
  }

  const bodyText =
    `Hey,\n\nI wanted to share this code snippet from Pluck with you:\n\n` +
    `📌 Snippet: ${title} (${lang})\n` +
    (desc ? `📝 Description: ${desc}\n` : '') +
    (dep ? `📦 Dependencies: ${dep}\n` : '') +
    `🔗 Live URL: ${url}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💻 CODE:\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${snippetPreview}\n\n` +
    `---\n` +
    `Shared from Pluck (Stop saving dead text. Pluck battle-tested code.)`;

  safeCopyText(code, 'Opening Mail app... Full code also copied to clipboard!');
  setTimeout(() => {
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  }, 250);
}

function shareToGmail() {
  const { title, lang, desc, code, dep, url } = getSharePayload();
  const su = encodeURIComponent(`[Pluck Snippet] ${title} (${lang})`);
  
  let snippetPreview = code;
  if (snippetPreview.length > 1000) {
    snippetPreview = snippetPreview.substring(0, 1000) + `\n\n... [Full code available at: ${url}]`;
  }

  const bodyText =
    `Hey,\n\nI wanted to share this code snippet from Pluck with you:\n\n` +
    `📌 Snippet: ${title} (${lang})\n` +
    (desc ? `📝 Description: ${desc}\n` : '') +
    (dep ? `📦 Dependencies: ${dep}\n` : '') +
    `🔗 View on Pluck: ${url}\n\n` +
    `--- Code ---\n${snippetPreview}\n`;

  safeCopyText(code, 'Opening Gmail... Full code also copied to clipboard!');
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${su}&body=${encodeURIComponent(bodyText)}`;
  setTimeout(() => {
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  }, 250);
}

function copyEmailDraft() {
  const { title, lang, desc, code, dep, url } = getSharePayload();
  const emailDraft =
    `Subject: [Pluck Snippet] ${title} (${lang})\n\n` +
    `Hey,\n\nCheck out this code snippet on Pluck:\n\n` +
    `📌 Title: ${title} (${lang})\n` +
    (desc ? `📝 Description: ${desc}\n` : '') +
    (dep ? `📦 Dependencies: ${dep}\n` : '') +
    `🔗 Link: ${url}\n\n` +
    `\`\`\`${lang.toLowerCase()}\n${code}\n\`\`\``;

  safeCopyText(emailDraft, 'Formatted email draft copied to clipboard!');
}

// ── 2. Code Sharing Sites & Sandboxes ──────────────────────────

function shareToGitHubGist() {
  const { code } = getSharePayload();
  safeCopyText(code, 'Code copied! Opening GitHub Gist...');
  setTimeout(() => {
    window.open('https://gist.github.com/', '_blank', 'noopener,noreferrer');
  }, 350);
}

function shareToRaySo() {
  const { title, lang, code } = getSharePayload();
  safeCopyText(code, 'Code copied! Opening Ray.so...');
  try {
    const base64Code = btoa(unescape(encodeURIComponent(code)));
    const rayUrl = `https://ray.so/#code=${encodeURIComponent(base64Code)}&title=${encodeURIComponent(title)}&theme=midnight&language=${encodeURIComponent(lang.toLowerCase())}`;
    setTimeout(() => {
      window.open(rayUrl, '_blank', 'noopener,noreferrer');
    }, 250);
  } catch (e) {
    setTimeout(() => {
      window.open('https://ray.so/', '_blank', 'noopener,noreferrer');
    }, 250);
  }
}

function shareToCodeSandbox() {
  const { code } = getSharePayload();
  safeCopyText(code, 'Code copied! Opening CodeSandbox...');
  setTimeout(() => {
    window.open('https://codesandbox.io/s/new', '_blank', 'noopener,noreferrer');
  }, 350);
}

function shareToStackBlitz() {
  const { code } = getSharePayload();
  safeCopyText(code, 'Code copied! Opening StackBlitz...');
  setTimeout(() => {
    window.open('https://stackblitz.com/', '_blank', 'noopener,noreferrer');
  }, 350);
}

// ── 3. Social & Developer Channels ────────────────────────────

function shareToLinkedIn() {
  const { title, lang, url } = getSharePayload();
  safeCopyText(`${title} (${lang}): ${url}`, 'Link copied! Opening LinkedIn...');
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  setTimeout(() => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=650,height=650');
  }, 250);
}

function shareToTwitter() {
  const { title, lang, url } = getSharePayload();
  const tweetText = `Check out this battle-tested ${lang} snippet: "${title}" on @pluckdev!\n\n${url}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  window.open(tweetUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
}

function shareToReddit() {
  const { title, lang, url } = getSharePayload();
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(`[Pluck Snippet] ${title} (${lang})`)}`;
  window.open(redditUrl, '_blank', 'noopener,noreferrer,width=700,height=650');
}

function shareToWhatsApp() {
  const { title, url } = getSharePayload();
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out "${title}" on Pluck: ${url}`)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

function shareNativeDevice() {
  const { title, desc, url } = getSharePayload();
  if (navigator.share) {
    navigator.share({
      title: `${title} — Pluck Snippet`,
      text: desc || `Check out ${title} on Pluck`,
      url: url
    }).catch(() => {});
  } else {
    copyShareModalLink();
  }
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('share-modal');
    if (modal && modal.classList.contains('open')) {
      closeShareModal();
    }
  }
});
