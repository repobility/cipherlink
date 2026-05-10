/**
 * Cipherlink — viewer.
 *
 * URL shape: /s/<id>#k=<urlsafe-base64-key>
 *   - id  read from path
 *   - key read from URL fragment — never sent to the server
 *
 * Flow:
 *   1. Page loads, parses id + key from URL.
 *   2. We peek at /api/secrets/:id/meta to see if the record exists (does NOT
 *      consume a read). Show "this is a one-time secret, reveal?" confirm.
 *   3. On confirm, GET /api/secrets/:id consumes one read and returns
 *      ciphertext + nonce. Browser decrypts and displays plaintext.
 *   4. Page reload after consumption shows "secret unavailable".
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const els = {
    loading: $('#loading-card'),
    confirm: $('#confirm-card'),
    confirmMeta: $('#confirm-meta'),
    btnReveal: $('#btn-reveal'),
    btnCancel: $('#btn-cancel'),
    secret: $('#secret-card'),
    plaintext: $('#plaintext'),
    btnCopySecret: $('#btn-copy-secret'),
    btnCreateNew: $('#btn-create-new'),
    postMeta: $('#post-meta'),
    error: $('#error-card'),
    errorTitle: $('#error-title'),
    errorDetail: $('#error-detail'),
    btnErrorNew: $('#btn-error-new'),
  };

  function showOnly(card) {
    for (const c of [els.loading, els.confirm, els.secret, els.error]) {
      c.hidden = c !== card;
    }
  }

  function showError(title, detail) {
    els.errorTitle.textContent = title;
    els.errorDetail.textContent = detail;
    showOnly(els.error);
  }

  function parseUrl() {
    const m = location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)$/);
    if (!m) return null;
    const id = m[1];
    const frag = location.hash.replace(/^#/, '');
    const params = new URLSearchParams(frag);
    const key = params.get('k');
    if (!key) return null;
    return { id, key };
  }

  async function peek(id) {
    const res = await fetch(`/api/secrets/${encodeURIComponent(id)}/meta`);
    if (!res.ok) return null;
    return res.json();
  }

  async function consume(id) {
    const res = await fetch(`/api/secrets/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    return res.json();
  }

  async function init() {
    const parsed = parseUrl();
    if (!parsed) {
      showError('Invalid link', 'The URL is missing an id or a decryption key.');
      return;
    }

    let meta;
    try {
      meta = await peek(parsed.id);
    } catch (err) {
      console.warn('peek failed:', err);
      showError('Network error', 'Could not reach the server. Try again.');
      return;
    }

    if (!meta) {
      showError(
        'Secret unavailable',
        'This secret has already been read, expired, or never existed. By design, we cannot recover it.',
      );
      return;
    }

    const expiry = new Date(meta.expiresAt);
    els.confirmMeta.textContent = `Expires ${expiry.toLocaleString()} • ${meta.readsRemaining} read${
      meta.readsRemaining === 1 ? '' : 's'
    } remaining.`;
    showOnly(els.confirm);
  }

  async function reveal() {
    const parsed = parseUrl();
    if (!parsed) return;

    els.btnReveal.disabled = true;
    els.btnReveal.textContent = 'Decrypting…';

    let body;
    try {
      body = await consume(parsed.id);
    } catch (e) {
      if (String(e.message) === 'not_found' || String(e.message) === 'expired') {
        showError(
          'Secret unavailable',
          'This secret has already been read or expired. By design, we cannot recover it.',
        );
      } else {
        showError('Server error', String(e.message));
      }
      return;
    }

    const keyB64 = CL_Crypto.fromUrlSafe(parsed.key);
    const decoded = CL_Crypto.decryptSecret(body.ciphertext, body.nonce, keyB64);

    if (!decoded) {
      showError(
        'Could not decrypt',
        "Wrong key in the URL, or the ciphertext was tampered with. Make sure you copied the entire URL, including the part after the '#'.",
      );
      return;
    }

    els.plaintext.textContent = decoded.text;
    const ageMs = decoded.ts ? Date.now() - decoded.ts : null;
    els.postMeta.textContent = `Server copy has been destroyed${
      body.remaining > 0 ? ` (${body.remaining} read${body.remaining === 1 ? '' : 's'} still available)` : ''
    }${ageMs != null ? ` • created ${formatAge(ageMs)} ago` : ''}.`;

    showOnly(els.secret);
  }

  function formatAge(ms) {
    const s = Math.round(ms / 1000);
    if (s < 90) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 90) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 36) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(els.plaintext.textContent);
      els.btnCopySecret.textContent = 'Copied ✓';
      setTimeout(() => (els.btnCopySecret.textContent = 'Copy to clipboard'), 1500);
    } catch (err) {
      // Best effort — clipboard write can fail without a user gesture or
      // outside a secure context. The secret is on screen for the user to
      // select manually; we just surface that fallback.
      console.warn('copySecret failed:', err);
      els.btnCopySecret.textContent = 'Copy failed — select & ⌘C';
      setTimeout(() => (els.btnCopySecret.textContent = 'Copy to clipboard'), 1800);
    }
  }

  els.btnReveal.addEventListener('click', reveal);
  els.btnCancel.addEventListener('click', () => {
    location.href = '/';
  });
  els.btnCopySecret.addEventListener('click', copySecret);
  els.btnCreateNew.addEventListener('click', () => {
    location.href = '/';
  });
  els.btnErrorNew.addEventListener('click', () => {
    location.href = '/';
  });

  init();
})();
