/**
 * Server tests.
 *
 * Boots the real server on an ephemeral port and verifies the wire-level
 * invariants:
 *   - the server stores and returns ciphertext + nonce but never sees the key
 *   - it rejects malformed payloads
 *   - GET /api/secrets/:id atomically consumes one read (one-time-secret)
 *   - expired or read-exhausted records are deleted
 *   - the viewer route /s/:id renders the SPA shell
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const nacl = require('tweetnacl');
const u = require('tweetnacl-util');

const PORT = 3700 + Math.floor(Math.random() * 200);
const URL = `http://127.0.0.1:${PORT}`;

let server;

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 8000);
    server.stdout.on('data', (buf) => {
      if (buf.toString().includes('listening')) {
        clearTimeout(t);
        resolve();
      }
    });
    server.stderr.on('data', (buf) => process.stderr.write(buf));
  });
});

test.after(async () => {
  if (!server) return;
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
});

function encrypt(plaintext) {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const env = JSON.stringify({ v: 1, t: plaintext, ts: Date.now() });
  const ct = nacl.secretbox(u.decodeUTF8(env), nonce, key);
  return {
    key: u.encodeBase64(key),
    nonce: u.encodeBase64(nonce),
    ciphertext: u.encodeBase64(ct),
  };
}

async function post(path, body) {
  const res = await fetch(URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function get(path) {
  const res = await fetch(URL + path);
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test('healthz returns ok', async () => {
  const res = await fetch(`${URL}/healthz`);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('POST + GET round-trips ciphertext; plaintext never on the wire', async () => {
  const env = encrypt('plaintext-that-must-not-leak-' + Math.random());
  const create = await post('/api/secrets', {
    ciphertext: env.ciphertext,
    nonce: env.nonce,
    ttlSeconds: 60,
    maxReads: 1,
  });
  assert.equal(create.status, 200);
  assert.equal(typeof create.body.id, 'string');

  const read = await get(`/api/secrets/${create.body.id}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.ciphertext, env.ciphertext, 'server must echo the ciphertext verbatim');
  assert.equal(read.body.nonce, env.nonce);

  // The key NEVER appears in any server response.
  const wire = JSON.stringify(read.body);
  assert.equal(wire.includes(env.key), false, 'key must not be present in server response');
});

test('GET consumes one read; second GET returns 404', async () => {
  const env = encrypt('one-time');
  const create = await post('/api/secrets', {
    ciphertext: env.ciphertext,
    nonce: env.nonce,
    ttlSeconds: 60,
    maxReads: 1,
  });
  const first = await get(`/api/secrets/${create.body.id}`);
  assert.equal(first.status, 200);
  const second = await get(`/api/secrets/${create.body.id}`);
  assert.equal(second.status, 404);
  assert.equal(second.body.error, 'not_found');
});

test('maxReads=3 allows exactly three reads', async () => {
  const env = encrypt('thrice');
  const create = await post('/api/secrets', {
    ciphertext: env.ciphertext,
    nonce: env.nonce,
    ttlSeconds: 60,
    maxReads: 3,
  });
  for (let i = 0; i < 3; i++) {
    const r = await get(`/api/secrets/${create.body.id}`);
    assert.equal(r.status, 200, `read ${i + 1} should succeed`);
  }
  const r4 = await get(`/api/secrets/${create.body.id}`);
  assert.equal(r4.status, 404, '4th read must be 404');
});

test('peek (/meta) does NOT consume a read', async () => {
  const env = encrypt('peek-only');
  const create = await post('/api/secrets', {
    ciphertext: env.ciphertext,
    nonce: env.nonce,
    ttlSeconds: 60,
    maxReads: 1,
  });
  for (let i = 0; i < 5; i++) {
    const meta = await get(`/api/secrets/${create.body.id}/meta`);
    assert.equal(meta.status, 200);
    assert.equal(meta.body.readsRemaining, 1, 'peek must not decrement');
  }
  // Now actually consume
  const read = await get(`/api/secrets/${create.body.id}`);
  assert.equal(read.status, 200);
  const after = await get(`/api/secrets/${create.body.id}/meta`);
  assert.equal(after.status, 404, 'after consumption meta must 404');
});

test('rejects malformed ciphertext, nonce, and id', async () => {
  const env = encrypt('x');
  // Bad ciphertext
  const badCt = await post('/api/secrets', {
    ciphertext: 'not!base64',
    nonce: env.nonce,
    ttlSeconds: 60,
    maxReads: 1,
  });
  assert.equal(badCt.status, 400);
  assert.equal(badCt.body.error, 'invalid_ciphertext');

  // Empty ciphertext
  const emptyCt = await post('/api/secrets', {
    ciphertext: '',
    nonce: env.nonce,
    ttlSeconds: 60,
    maxReads: 1,
  });
  assert.equal(emptyCt.status, 400);

  // Bad nonce
  const badNonce = await post('/api/secrets', {
    ciphertext: env.ciphertext,
    nonce: 'nope',
    ttlSeconds: 60,
    maxReads: 1,
  });
  assert.equal(badNonce.status, 400);
  assert.equal(badNonce.body.error, 'invalid_nonce');

  // Bad id on read
  const badId = await get('/api/secrets/not-a-real-id!!');
  assert.equal(badId.status, 400);
});

test('TTL is clamped to [60s, 7d]', async () => {
  const env = encrypt('clamped');
  // 1-second TTL is below the floor; server should clamp to 60s.
  const create = await post('/api/secrets', {
    ciphertext: env.ciphertext,
    nonce: env.nonce,
    ttlSeconds: 1,
    maxReads: 1,
  });
  assert.equal(create.status, 200);
  const ttlMs = create.body.expiresAt - Date.now();
  assert.ok(ttlMs >= 50 * 1000, `expected >= 50s, got ${ttlMs}ms`);
});

test('viewer route /s/:id serves the viewer HTML shell', async () => {
  const res = await fetch(`${URL}/s/aaaaaaaaaaaaaaaaaaaaaa`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /Cipherlink/, 'viewer page should mention Cipherlink');
  assert.match(text, /view\.js/, 'viewer page should load /view.js');
});
