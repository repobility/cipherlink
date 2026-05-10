/**
 * Cipherlink crypto helpers.
 *
 * Primitive: nacl.secretbox  (XSalsa20 + Poly1305 authenticated encryption,
 * 32-byte key, 24-byte nonce).
 *
 * Wire format:
 *   ciphertext = nacl.secretbox(plaintext, nonce, key)
 *   nonce      = 24 random bytes
 *   key        = 32 random bytes  (stays in the URL fragment, never on the wire)
 *
 * Plaintext is wrapped in a versioned envelope { v, t, ts } so future
 * protocol changes can be detected by the receiver.
 */
(function () {
  'use strict';

  const util = window.nacl_util || window.naclUtil;
  if (!window.nacl || !util) throw new Error('TweetNaCl libraries failed to load');

  const PROTO_VERSION = 1;
  const MAX_PLAINTEXT_BYTES = 16 * 1024;

  function newKey() {
    return nacl.randomBytes(nacl.secretbox.keyLength);
  }

  function newNonce() {
    return nacl.randomBytes(nacl.secretbox.nonceLength);
  }

  function encryptSecret(plaintext) {
    if (typeof plaintext !== 'string') throw new Error('plaintext must be a string');
    if (plaintext.length === 0) throw new Error('empty secret');
    if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error('secret too long');

    const key = newKey();
    const nonce = newNonce();
    const envelope = JSON.stringify({ v: PROTO_VERSION, t: plaintext, ts: Date.now() });
    const msgBytes = util.decodeUTF8(envelope);
    const ct = nacl.secretbox(msgBytes, nonce, key);
    if (!ct) throw new Error('encryption failed');

    return {
      key: util.encodeBase64(key),
      nonce: util.encodeBase64(nonce),
      ciphertext: util.encodeBase64(ct),
    };
  }

  function decryptSecret(ciphertextB64, nonceB64, keyB64) {
    try {
      const ct = util.decodeBase64(ciphertextB64);
      const nonce = util.decodeBase64(nonceB64);
      const key = util.decodeBase64(keyB64);
      if (key.length !== nacl.secretbox.keyLength) return null;
      if (nonce.length !== nacl.secretbox.nonceLength) return null;
      const opened = nacl.secretbox.open(ct, nonce, key);
      if (!opened) return null;
      const obj = JSON.parse(util.encodeUTF8(opened));
      if (!obj || obj.v !== PROTO_VERSION || typeof obj.t !== 'string') return null;
      return { text: obj.t, ts: typeof obj.ts === 'number' ? obj.ts : null };
    } catch (_) {
      return null;
    }
  }

  function toUrlSafe(b64) {
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromUrlSafe(b64u) {
    let s = b64u.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (s.length % 4)) % 4;
    return s + '='.repeat(pad);
  }

  window.CL_Crypto = {
    encryptSecret,
    decryptSecret,
    toUrlSafe,
    fromUrlSafe,
    MAX_PLAINTEXT_BYTES,
  };
})();
