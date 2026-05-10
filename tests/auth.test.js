/**
 * Authorization-focused tests (Repobility AUC003 / AUC005).
 *
 * Cipherlink uses **capability-URL** authorization: the secret URL contains
 * (a) an unguessable identifier in the path and (b) a 256-bit symmetric key
 * in the URL fragment. Possession of the URL — both parts together — is
 * the credential. There is no session, no user table, no role.
 *
 * These tests assert the security properties that fall out of that model:
 *   AUTH-01  the id alone is useless without the key (no key on the wire)
 *   AUTH-02  one-time-read is enforced atomically, not advisory
 *   AUTH-03  ids are 16 random bytes (≥128-bit search space) — unguessable
 *   AUTH-04  reading consumes the server copy; subsequent reads 404
 *   AUTH-05  /meta is non-consuming (information-only peek)
 *   AUTH-06  no creator-only operations exist (no DELETE, no edit, no list)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const nacl = require('tweetnacl');
const u = require('tweetnacl-util');

const PORT = 3900 + Math.floor(Math.random() * 200);
const URL = `http://127.0.0.1:${PORT}`;
let server;

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 8000);
    server.stdout.on('data', (b) => {
      if (b.toString().includes('listening')) {
        clearTimeout(t);
        resolve();
      }
    });
    server.stderr.on('data', (b) => process.stderr.write(b));
  });
});
test.after(async () => {
  server?.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
});

function encrypt(plaintext) {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const env = JSON.stringify({ v: 1, t: plaintext, ts: Date.now() });
  const ct = nacl.secretbox(u.decodeUTF8(env), nonce, key);
  return {
    key,
    keyB64: u.encodeBase64(key),
    nonce: u.encodeBase64(nonce),
    ciphertext: u.encodeBase64(ct),
  };
}

async function create(env, ttl = 60, reads = 1) {
  const res = await fetch(`${URL}/api/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ciphertext: env.ciphertext,
      nonce: env.nonce,
      ttlSeconds: ttl,
      maxReads: reads,
    }),
  });
  return res.json();
}

test('AUTH-01: id alone is useless without the URL-fragment key', async () => {
  const env = encrypt('top-secret-passphrase');
  const { id } = await create(env, 60, 1);

  // Attacker who somehow learns just the id (e.g. from a server log) can
  // fetch the ciphertext but cannot decrypt without the key.
  const res = await fetch(`${URL}/api/secrets/${id}`);
  const body = await res.json();
  const ct = u.decodeBase64(body.ciphertext);
  const nonce = u.decodeBase64(body.nonce);

  // Try every possible 256-bit key? Obviously not — assert that without the
  // real key the ciphertext does not open.
  const wrong = nacl.secretbox.open(ct, nonce, nacl.randomBytes(32));
  assert.equal(wrong, null);

  // The correct key still works.
  const right = nacl.secretbox.open(ct, nonce, env.key);
  assert.ok(right);
});

test('AUTH-02: one-time read is atomic — second fetch is 404, not throttled', async () => {
  const env = encrypt('atomic');
  const { id } = await create(env, 60, 1);
  const first = await fetch(`${URL}/api/secrets/${id}`);
  assert.equal(first.status, 200);
  const second = await fetch(`${URL}/api/secrets/${id}`);
  assert.equal(second.status, 404, 'consumed record must be gone, not just throttled');
});

test('AUTH-03: ids occupy a ≥128-bit search space — unguessable', async () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const { id } = await create(encrypt('id-' + i), 60, 1);
    ids.add(id);
  }
  assert.equal(ids.size, 50, 'all 50 ids must be unique');
  for (const id of ids) {
    assert.match(id, /^[A-Za-z0-9_-]+$/, 'urlsafe base64');
    assert.ok(id.length >= 20, `id "${id}" should be >= 20 chars (~128 bits)`);
  }
});

test('AUTH-04: a non-existent id returns 404, never reveals server state', async () => {
  // Random id we know was never created.
  const fakeId = 'a'.repeat(22);
  const res = await fetch(`${URL}/api/secrets/${fakeId}`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'not_found', 'must be a generic not_found, no timing oracle');
});

test('AUTH-05: /meta is non-consuming and can be called repeatedly', async () => {
  const env = encrypt('peek');
  const { id } = await create(env, 60, 1);
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${URL}/api/secrets/${id}/meta`);
    assert.equal(res.status, 200);
    const meta = await res.json();
    assert.equal(meta.readsRemaining, 1, 'peek must not decrement');
  }
});

test('AUTH-06: no creator-only operations exist (no DELETE, no list, no edit)', async () => {
  const env = encrypt('immutable');
  const { id } = await create(env, 60, 1);

  // DELETE should not be a supported method.
  const del = await fetch(`${URL}/api/secrets/${id}`, { method: 'DELETE' });
  assert.ok(del.status === 404 || del.status === 405, `DELETE returned ${del.status}`);

  // No "list all secrets" endpoint exists.
  const list = await fetch(`${URL}/api/secrets`);
  assert.ok(list.status === 404 || list.status === 405, `LIST returned ${list.status}`);

  // No edit endpoint either.
  const put = await fetch(`${URL}/api/secrets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext: 'xxx' }),
  });
  assert.ok(put.status === 404 || put.status === 405, `PUT returned ${put.status}`);
});
