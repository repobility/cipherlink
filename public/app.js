/**
 * Cipherlink — compose view.
 *
 * 1. User types a secret into the textarea and picks TTL + max-reads.
 * 2. Browser generates a random 32-byte key + 24-byte nonce.
 * 3. Browser encrypts via CL_Crypto.encryptSecret, posts { ciphertext, nonce }
 *    to /api/secrets, gets back an id.
 * 4. Page assembles a URL: https://host/s/<id>#k=<urlsafe-base64-key>
 *    and shows it to the user. The key lives in the URL fragment, which
 *    browsers never send in HTTP requests — so the server cannot learn it.
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const els = {
    secret: $('#secret'),
    ttl: $('#ttl'),
    maxReads: $('#max-reads'),
    btnCreate: $('#btn-create'),
    composeErr: $('#compose-err'),
    composeCard: $('#compose-card'),
    resultCard: $('#result-card'),
    resultUrl: $('#result-url'),
    resultMeta: $('#result-meta'),
    btnCopy: $('#btn-copy'),
    btnNew: $('#btn-new'),
  };

  function showError(msg) {
    els.composeErr.textContent = msg;
    els.composeErr.hidden = false;
  }
  function clearError() {
    els.composeErr.hidden = true;
  }

  async function createSecret() {
    clearError();
    const text = els.secret.value;
    if (!text || !text.trim()) {
      showError('Type something to encrypt first.');
      return;
    }
    if (text.length > CL_Crypto.MAX_PLAINTEXT_BYTES) {
      showError('Secret is too long (max 16 KiB).');
      return;
    }

    let env;
    try {
      env = CL_Crypto.encryptSecret(text);
    } catch (e) {
      showError('Encryption failed: ' + e.message);
      return;
    }

    const ttlSeconds = Number(els.ttl.value);
    const maxReads = Number(els.maxReads.value);

    els.btnCreate.disabled = true;
    els.btnCreate.textContent = 'Encrypting…';

    let res, body;
    try {
      res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: env.ciphertext,
          nonce: env.nonce,
          ttlSeconds,
          maxReads,
        }),
      });
      body = await res.json();
    } catch (e) {
      els.btnCreate.disabled = false;
      els.btnCreate.textContent = 'Encrypt & create link';
      showError('Network error: ' + e.message);
      return;
    }

    els.btnCreate.disabled = false;
    els.btnCreate.textContent = 'Encrypt & create link';

    if (!res.ok) {
      showError('Server rejected the secret: ' + (body && body.error ? body.error : res.statusText));
      return;
    }

    const url = `${location.origin}/s/${body.id}#k=${CL_Crypto.toUrlSafe(env.key)}`;
    els.resultUrl.value = url;

    const expiry = new Date(body.expiresAt);
    els.resultMeta.textContent = `Expires ${expiry.toLocaleString()} • burns after ${
      body.readsRemaining
    } read${body.readsRemaining === 1 ? '' : 's'}.`;

    els.composeCard.hidden = true;
    els.resultCard.hidden = false;
    els.resultUrl.focus();
    els.resultUrl.select();

    // Zero the plaintext from the form. The key is also zeroed by leaving
    // the local scope — the only copy left is in the URL we just built.
    els.secret.value = '';
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(els.resultUrl.value);
      els.btnCopy.textContent = 'Copied ✓';
      setTimeout(() => (els.btnCopy.textContent = 'Copy'), 1500);
    } catch (_) {
      els.resultUrl.focus();
      els.resultUrl.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
      els.btnCopy.textContent = 'Copied ✓';
      setTimeout(() => (els.btnCopy.textContent = 'Copy'), 1500);
    }
  }

  function reset() {
    els.resultCard.hidden = true;
    els.composeCard.hidden = false;
    els.secret.focus();
  }

  els.btnCreate.addEventListener('click', createSecret);
  els.btnCopy.addEventListener('click', copyResult);
  els.btnNew.addEventListener('click', reset);

  els.secret.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') createSecret();
  });

  els.secret.focus();
})();
