# Architecture

A single-page web app talking to an Express server that holds only
ciphertext. The server never holds a key and cannot decrypt anything.

```
       ┌──────────────────────────────────────┐
       │           Compose page               │
       │           (public/index.html)        │
       │                                      │
       │  1. user types secret                │
       │  2. random 32-byte key               │
       │  3. random 24-byte nonce             │
       │  4. ct = nacl.secretbox(             │
       │           plaintext, nonce, key)     │
       │  5. POST { ciphertext, nonce } ──┐   │
       └──────────────────────────────────┼───┘
                                          │
                                          ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │                          Server (server.js)                        │
   │                                                                    │
   │  POST /api/secrets          → mint random id, store record         │
   │  GET  /api/secrets/:id      → atomic read-then-delete-or-decrement │
   │  GET  /api/secrets/:id/meta → non-consuming peek                   │
   │  GET  /s/:id                → viewer SPA shell                     │
   │  GET  /healthz              → liveness probe                       │
   │                                                                    │
   │  In-memory store keyed by 22-char urlsafe-base64 id:               │
   │    { ciphertext, nonce, expiresAt, readsRemaining, createdAt }     │
   │                                                                    │
   │  Periodic sweep removes expired or zero-reads records.             │
   │                                                                    │
   │  The server holds NO keys. It cannot decrypt anything.             │
   └────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼ HTTP(S)
       ┌──────────────────────────────────────┐
       │           Viewer page                │
       │           (public/view.html)         │
       │                                      │
       │  6. parse /s/<id>#k=<key> from URL   │
       │  7. peek /api/secrets/:id/meta       │
       │     → show "this consumes a read"    │
       │  8. user confirms                    │
       │  9. GET /api/secrets/:id consumes    │
       │     and returns ct + nonce           │
       │ 10. opened = nacl.secretbox.open(    │
       │           ct, nonce, key)            │
       │ 11. show plaintext                   │
       └──────────────────────────────────────┘
```

## Layers

### 1. Crypto (`public/crypto-utils.js`)

Loads `nacl` and `nacl-util` from `window`. Exposes a `CL_Crypto`
namespace with:

- `encryptSecret(plaintext)` — generates a fresh 32-byte key and 24-byte
  nonce, returns `{ key, nonce, ciphertext }` (all base64).
- `decryptSecret(ciphertext, nonce, key)` — returns `{ text, ts }` or
  `null` on every failure mode (wrong key, tampered ciphertext, bad
  envelope). Callers cannot distinguish, by design.
- `toUrlSafe(b64)` / `fromUrlSafe(b64u)` — RFC 4648 §5 base64-url
  conversions used to embed the key in the URL fragment without
  needing to URL-encode.

### 2. Compose flow (`public/app.js`)

State-free; runs once on the compose page. Calls `encryptSecret`,
POSTs the ciphertext + nonce + TTL + max-reads, builds
`location.origin + "/s/" + id + "#k=" + toUrlSafe(key)`, copies to
clipboard on demand. The plaintext field is cleared after submission
and the key only exists in the URL we just built.

### 3. Viewer flow (`public/view.js`)

Reads id from `location.pathname` and key from `location.hash`. Peeks
the `/meta` endpoint to render a "this will consume a read" confirm
dialog _without_ burning the read. On confirm, calls
`GET /api/secrets/:id` (which atomically consumes one read) and
decrypts client-side. Failure modes (`null` from decrypt, 404, 410,
network error) are surfaced as distinct UI states.

### 4. Server (`server.js`)

`createServer()` builds the Express app, wires the routes, attaches a
periodic sweep timer, and returns the trio. `listen(server, port,
host)` binds. When invoked as `node server.js`, the module boots the
server; when required from tests, only the factory + helpers are
exported.

The store is a single `SecretStore` instance (class wrapper over a
`Map`). Per-secret records carry expiry and read counter; both the
sweep timer and every GET enforce expiry / depletion atomically.

Validation regexes:

- `B64_RE` — `^[A-Za-z0-9+/]+={0,2}$`
- `ID_RE` — `^[A-Za-z0-9_-]{20,32}$` (urlsafe base64, 16-byte random)
- nonce length is exactly 32 (for 24-byte decoded)
- ciphertext length is ≥ 24 (16-byte MAC encoded) and ≤ 128 KiB

### 5. Tests (`tests/`)

Three suites run under Node's built-in test runner:

- `crypto.test.js` — loads `public/crypto-utils.js` into a `vm`
  sandbox, asserts roundtrip + tamper rejection + nonce uniqueness.
- `server.test.js` — boots `server.js` on an ephemeral port, drives
  the HTTP API, verifies ciphertext echo, one-time-read property,
  validation errors, TTL clamping, viewer-shell rendering.
- `auth.test.js` — six AUTH-\* cases that prove the capability-URL
  matrix in `.repobility/access.yml`: id alone is useless, one-time
  read is atomic, ids are ≥128-bit, /meta is non-consuming, no
  DELETE/edit/list exist.

## Threat model summary

See [SECURITY.md](SECURITY.md) for the full breakdown. Headline:

| Adversary                         | Defended?                               |
| --------------------------------- | --------------------------------------- |
| Honest-but-curious operator       | ✅ confidentiality and integrity        |
| Passive network observer (w/ TLS) | ✅                                      |
| Active MITM (w/ TLS)              | ✅ — Poly1305 catches tampering         |
| URL leakage (browser history)     | ⚠️ one-time-read is the main mitigation |
| Referer leakage from view page    | ✅ `no-referrer` meta                   |
| Compromised browser / XSS         | ⚠️ best-effort via strict CSP           |
| Compromised server delivering JS  | ⚠️ trust-the-server-once problem        |
