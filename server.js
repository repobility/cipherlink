/**
 * Cipherlink — one-time encrypted secret sharing.
 *
 * Trust model: the server only ever sees ciphertext + nonce + the metadata
 * the creator chose (TTL, max-reads). The symmetric key is generated in the
 * browser and travels in the URL fragment (`#k=…`), which the browser never
 * sends in HTTP requests — so the server cannot decrypt a secret even with
 * full access to its own logs.
 */

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const MAX_CIPHERTEXT_BYTES = 128 * 1024; // 128 KiB after base64 expansion
const MAX_NONCE_LEN = 32;
const MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_READS = 100;

// id -> { ciphertext, nonce, expiresAt, readsRemaining, createdAt }
const store = new Map();

function genId() {
  // 16 random bytes, base64url — short enough to fit in a URL, long enough
  // to be unguessable.
  return crypto.randomBytes(16).toString('base64url');
}

function isB64(s, maxLen) {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > maxLen) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

function sweep() {
  const now = Date.now();
  for (const [id, rec] of store) {
    if (rec.expiresAt <= now || rec.readsRemaining <= 0) {
      store.delete(id);
    }
  }
}
setInterval(sweep, 60 * 1000).unref();

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// NaCl libraries served from node_modules so the browser doesn't depend on a CDN.
app.get('/vendor/nacl/nacl.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/tweetnacl/nacl.min.js'));
});
app.get('/vendor/nacl/nacl-util.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/tweetnacl-util/nacl-util.min.js'));
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, stored: store.size });
});

app.post('/api/secrets', (req, res) => {
  const { ciphertext, nonce, ttlSeconds, maxReads } = req.body || {};

  if (!isB64(ciphertext, MAX_CIPHERTEXT_BYTES)) {
    return res.status(400).json({ error: 'invalid_ciphertext' });
  }
  if (!isB64(nonce, MAX_NONCE_LEN)) {
    return res.status(400).json({ error: 'invalid_nonce' });
  }

  const ttl = Math.min(Math.max(Number(ttlSeconds) || 86400, 60), MAX_TTL_MS / 1000);
  const reads = Math.min(Math.max(Number(maxReads) || 1, 1), MAX_READS);

  // Generate a random ID. In the extremely unlikely event of a collision,
  // try again.
  let id = genId();
  for (let tries = 0; tries < 5 && store.has(id); tries++) {
    id = genId();
  }
  if (store.has(id)) {
    return res.status(500).json({ error: 'id_collision' });
  }

  const now = Date.now();
  store.set(id, {
    ciphertext,
    nonce,
    expiresAt: now + ttl * 1000,
    readsRemaining: reads,
    createdAt: now,
  });

  console.log(`stored secret ${id} ttl=${ttl}s reads=${reads}`);
  res.json({ id, expiresAt: now + ttl * 1000, readsRemaining: reads });
});

app.get('/api/secrets/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[A-Za-z0-9_-]{20,32}$/.test(id)) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  const rec = store.get(id);
  if (!rec) {
    return res.status(404).json({ error: 'not_found' });
  }

  const now = Date.now();
  if (rec.expiresAt <= now) {
    store.delete(id);
    return res.status(410).json({ error: 'expired' });
  }

  rec.readsRemaining -= 1;
  const expiresAt = rec.expiresAt;
  const remaining = rec.readsRemaining;
  const out = { ciphertext: rec.ciphertext, nonce: rec.nonce, expiresAt, remaining };

  if (rec.readsRemaining <= 0) {
    store.delete(id);
  } else {
    store.set(id, rec);
  }

  res.json(out);
});

app.get('/api/secrets/:id/meta', (req, res) => {
  const { id } = req.params;
  const rec = store.get(id);
  if (!rec) return res.status(404).json({ error: 'not_found' });
  res.json({
    expiresAt: rec.expiresAt,
    readsRemaining: rec.readsRemaining,
    createdAt: rec.createdAt,
  });
});

// SPA route: /s/<id> serves the viewer page.
app.get('/s/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`Cipherlink listening on http://${HOST}:${PORT}`);
});
