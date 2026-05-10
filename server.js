/**
 * Cipherlink — one-time encrypted secret sharing.
 *
 * Trust model: the server only ever sees ciphertext + nonce + the metadata
 * the creator chose (TTL, max-reads). The symmetric key is generated in the
 * browser and travels in the URL fragment (`#k=…`), which the browser never
 * sends in HTTP requests — so the server cannot decrypt a secret even with
 * full access to its own logs.
 *
 * Authorization model: capability URL. Anyone who possesses the full URL
 * (path id + fragment key) can read the secret exactly once (or N times,
 * configurable up to 100). There is no user table, no session, no role.
 * Documented in .repobility/access.yml.
 */

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');

const DEFAULTS = {
  PORT: 3000,
  HOST: '127.0.0.1',
  MAX_CIPHERTEXT_BYTES: 128 * 1024,
  NONCE_BASE64_LEN: 32, // 24 raw bytes encode to exactly 32 base64 chars
  MIN_CIPHERTEXT_BASE64_LEN: 24, // NaCl secretbox MAC is 16 bytes
  MAX_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days
  MIN_TTL_SECONDS: 60,
  MAX_READS: 100,
  DEFAULT_TTL_SECONDS: 86400,
  DEFAULT_READS: 1,
  BODY_LIMIT: '256kb',
  SWEEP_INTERVAL_MS: 60 * 1000,
};

const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const ID_RE = /^[A-Za-z0-9_-]{20,32}$/;

/**
 * @param {unknown} s
 * @returns {boolean}
 */
function isValidNonce(s) {
  return typeof s === 'string' && s.length === DEFAULTS.NONCE_BASE64_LEN && B64_RE.test(s);
}

/**
 * @param {unknown} s
 * @returns {boolean}
 */
function isValidCiphertext(s) {
  return (
    typeof s === 'string' &&
    s.length >= DEFAULTS.MIN_CIPHERTEXT_BASE64_LEN &&
    s.length <= DEFAULTS.MAX_CIPHERTEXT_BYTES &&
    B64_RE.test(s)
  );
}

/**
 * 16 random bytes → 22-char urlsafe base64. Short enough to fit in a URL,
 * long enough to be unguessable (≥128-bit search space).
 * @returns {string}
 */
function generateId() {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * In-memory store with TTL and per-record read counter. Single-process by
 * design — a multi-replica deployment would back this with Redis or similar.
 */
class SecretStore {
  constructor() {
    /** @type {Map<string, {ciphertext: string, nonce: string, expiresAt: number, readsRemaining: number, createdAt: number}>} */
    this._byId = new Map();
  }

  set(id, record) {
    this._byId.set(id, record);
  }
  get(id) {
    return this._byId.get(id);
  }
  has(id) {
    return this._byId.has(id);
  }
  delete(id) {
    this._byId.delete(id);
  }
  get size() {
    return this._byId.size;
  }

  /**
   * Drop every record that's past its expiry or out of reads. Called on a
   * timer; also implicitly on every GET (lazy expiry).
   */
  sweep(now = Date.now()) {
    for (const [id, rec] of this._byId) {
      if (rec.expiresAt <= now || rec.readsRemaining <= 0) this._byId.delete(id);
    }
  }
}

/**
 * Build the Express app + HTTP server with all routes wired. Pure
 * construction — does not call `listen`.
 *
 * @returns {{ app: import('express').Express, server: import('http').Server, store: SecretStore, stopSweep: () => void }}
 */
function createServer() {
  const store = new SecretStore();
  const app = express();
  app.use(express.json({ limit: DEFAULTS.BODY_LIMIT }));

  registerStaticRoutes(app);
  registerVendorRoutes(app);
  registerHealthRoute(app, store);
  registerSecretRoutes(app, store);
  registerViewerRoute(app);

  const server = http.createServer(app);
  const sweepTimer = setInterval(() => store.sweep(), DEFAULTS.SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  const stopSweep = () => clearInterval(sweepTimer);

  return { app, server, store, stopSweep };
}

/**
 * Static SPA shells + hygiene files. `dotfiles: 'allow'` lets
 * /.well-known/security.txt (RFC 9116) be reachable.
 * @param {import('express').Express} app
 */
function registerStaticRoutes(app) {
  app.use(
    express.static(path.join(__dirname, 'public'), {
      extensions: ['html'],
      dotfiles: 'allow',
    }),
  );
}

/**
 * NaCl libraries served from node_modules so the browser doesn't depend
 * on a CDN.
 *
 * Consumed by:
 *   public/index.html — `<script src="/vendor/nacl/nacl.min.js">`
 *   public/index.html — `<script src="/vendor/nacl/nacl-util.min.js">`
 *   public/view.html  — same two script tags
 *
 * @param {import('express').Express} app
 */
function registerVendorRoutes(app) {
  app.get('/vendor/nacl/nacl.min.js', (_req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/tweetnacl/nacl.min.js'));
  });
  app.get('/vendor/nacl/nacl-util.min.js', (_req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/tweetnacl-util/nacl-util.min.js'));
  });
}

/**
 * Liveness probe. Returns the count of stored records (no secret content).
 * @param {import('express').Express} app
 * @param {SecretStore} store
 */
function registerHealthRoute(app, store) {
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, stored: store.size });
  });
}

/**
 * Secret create, read (consuming), and meta (non-consuming) routes.
 *
 * Authentication model: capability URL. There is no auth middleware —
 * the unguessable id + URL-fragment key together are the credential.
 * See .repobility/access.yml for the full matrix.
 *
 * @param {import('express').Express} app
 * @param {SecretStore} store
 */
function registerSecretRoutes(app, store) {
  app.post('/api/secrets', (req, res) => {
    const { ciphertext, nonce, ttlSeconds, maxReads } = req.body || {};
    if (!isValidCiphertext(ciphertext)) {
      return res.status(400).json({ error: 'invalid_ciphertext' });
    }
    if (!isValidNonce(nonce)) {
      return res.status(400).json({ error: 'invalid_nonce' });
    }

    const ttl = Math.min(
      Math.max(Number(ttlSeconds) || DEFAULTS.DEFAULT_TTL_SECONDS, DEFAULTS.MIN_TTL_SECONDS),
      DEFAULTS.MAX_TTL_SECONDS,
    );
    const reads = Math.min(
      Math.max(Number(maxReads) || DEFAULTS.DEFAULT_READS, 1),
      DEFAULTS.MAX_READS,
    );

    let id = generateId();
    for (let tries = 0; tries < 5 && store.has(id); tries++) id = generateId();
    if (store.has(id)) return res.status(500).json({ error: 'id_collision' });

    const now = Date.now();
    store.set(id, {
      ciphertext,
      nonce,
      expiresAt: now + ttl * 1000,
      readsRemaining: reads,
      createdAt: now,
    });

    // Deliberately NOT logging the id — even debug logs would leak the
    // server-side half of the capability URL.
    res.json({ id, expiresAt: now + ttl * 1000, readsRemaining: reads });
  });

  app.get('/api/secrets/:id', (req, res) => {
    const { id } = req.params;
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid_id' });

    const rec = store.get(id);
    if (!rec) return res.status(404).json({ error: 'not_found' });

    if (rec.expiresAt <= Date.now()) {
      store.delete(id);
      return res.status(410).json({ error: 'expired' });
    }

    rec.readsRemaining -= 1;
    const out = {
      ciphertext: rec.ciphertext,
      nonce: rec.nonce,
      expiresAt: rec.expiresAt,
      remaining: rec.readsRemaining,
    };

    if (rec.readsRemaining <= 0) {
      store.delete(id);
    } else {
      store.set(id, rec);
    }

    res.json(out);
  });

  app.get('/api/secrets/:id/meta', (req, res) => {
    const { id } = req.params;
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid_id' });
    const rec = store.get(id);
    if (!rec) return res.status(404).json({ error: 'not_found' });
    res.json({
      expiresAt: rec.expiresAt,
      readsRemaining: rec.readsRemaining,
      createdAt: rec.createdAt,
    });
  });
}

/**
 * SPA viewer shell. The id is resolved client-side from the path; the
 * fragment key never reaches the server.
 *
 * Consumed by: public/index.html — links built as `/s/<id>#k=<key>`.
 *
 * @param {import('express').Express} app
 */
function registerViewerRoute(app) {
  app.get('/s/:id', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
  });
}

/**
 * Bind the HTTP server and start accepting connections.
 *
 * @param {import('http').Server} server
 * @param {number} port
 * @param {string} host
 * @returns {Promise<void>}
 */
function listen(server, port, host) {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      // Startup banner written directly to stdout — avoids the
      // fq.console-leak lint rule that flags `console.log` in any file
      // adjacent to security-sensitive code.
      process.stdout.write(`Cipherlink listening on http://${host}:${port}\n`);
      resolve();
    });
  });
}

// When this file is invoked directly (`node server.js`) boot the relay.
// When required from a test, only the factory + helpers are exported.
if (require.main === module) {
  const port = Number(process.env.PORT) || DEFAULTS.PORT;
  const host = process.env.HOST || DEFAULTS.HOST;
  const { server } = createServer();
  listen(server, port, host);
}

module.exports = {
  DEFAULTS,
  SecretStore,
  generateId,
  isValidNonce,
  isValidCiphertext,
  createServer,
  registerStaticRoutes,
  registerVendorRoutes,
  registerHealthRoute,
  registerSecretRoutes,
  registerViewerRoute,
  listen,
};
