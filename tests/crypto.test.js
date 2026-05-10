/**
 * Crypto-layer tests.
 *
 * Loads public/crypto-utils.js into a Node vm sandbox with `nacl` /
 * `nacl-util` bound as globals, and exercises the same encrypt/decrypt code
 * end users hit in the browser.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nacl = require('tweetnacl');
const u = require('tweetnacl-util');

function loadBrowserCrypto() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'crypto-utils.js'), 'utf8');
  const sandbox = { nacl, nacl_util: u, naclUtil: u };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.CL_Crypto;
}

const CL = loadBrowserCrypto();

test('encryptSecret + decryptSecret roundtrip recovers the plaintext', () => {
  const plaintext = 'the launch codes are 0000';
  const env = CL.encryptSecret(plaintext);
  assert.equal(typeof env.key, 'string');
  assert.equal(typeof env.nonce, 'string');
  assert.equal(typeof env.ciphertext, 'string');

  const opened = CL.decryptSecret(env.ciphertext, env.nonce, env.key);
  assert.ok(opened);
  assert.equal(opened.text, plaintext);
});

test('two encryptions of the same plaintext produce distinct ciphertexts', () => {
  const e1 = CL.encryptSecret('same');
  const e2 = CL.encryptSecret('same');
  assert.notEqual(e1.key, e2.key, 'each call must produce a fresh key');
  assert.notEqual(e1.nonce, e2.nonce, 'each call must produce a fresh nonce');
  assert.notEqual(e1.ciphertext, e2.ciphertext);
});

test('decrypt with a wrong key returns null (no plaintext leak)', () => {
  const env = CL.encryptSecret('confidential');
  const otherKey = u.encodeBase64(nacl.randomBytes(nacl.secretbox.keyLength));
  const opened = CL.decryptSecret(env.ciphertext, env.nonce, otherKey);
  assert.equal(opened, null);
});

test('decrypt with a wrong nonce returns null', () => {
  const env = CL.encryptSecret('hello');
  const otherNonce = u.encodeBase64(nacl.randomBytes(nacl.secretbox.nonceLength));
  const opened = CL.decryptSecret(env.ciphertext, otherNonce, env.key);
  assert.equal(opened, null);
});

test('Poly1305 rejects a single-bit ciphertext modification', () => {
  const env = CL.encryptSecret('integrity');
  const ct = Buffer.from(u.decodeBase64(env.ciphertext));
  ct[ct.length - 1] ^= 0x01;
  const opened = CL.decryptSecret(u.encodeBase64(ct), env.nonce, env.key);
  assert.equal(opened, null);
});

test('decrypt rejects wrong-length keys / nonces', () => {
  const env = CL.encryptSecret('size matters');
  const shortKey = u.encodeBase64(new Uint8Array(31));
  const shortNonce = u.encodeBase64(new Uint8Array(20));
  assert.equal(CL.decryptSecret(env.ciphertext, env.nonce, shortKey), null);
  assert.equal(CL.decryptSecret(env.ciphertext, shortNonce, env.key), null);
});

test('encryptSecret rejects empty and oversized plaintexts', () => {
  assert.throws(() => CL.encryptSecret(''));
  assert.throws(() => CL.encryptSecret('x'.repeat(CL.MAX_PLAINTEXT_BYTES + 1)));
});

test('toUrlSafe / fromUrlSafe round-trip preserves base64 content', () => {
  const original = u.encodeBase64(nacl.randomBytes(32));
  const safe = CL.toUrlSafe(original);
  assert.equal(/[+/=]/.test(safe), false, 'urlsafe output must not contain +, / or =');
  assert.equal(CL.fromUrlSafe(safe), original);
});
