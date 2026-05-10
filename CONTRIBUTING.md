# Contributing to Cipherlink

Thanks for your interest! Cipherlink is a small, auditable codebase — the
goal is to keep it readable end-to-end in a single sitting, so changes
are weighted toward simplicity and clarity over feature breadth.

## Ground rules

1. **Don't break the trust model.** The server must remain unable to read
   secrets. Any change that introduces server-side decryption, plaintext
   logging, persistent storage of secret contents, or breaks the
   capability-URL property is out of scope.
2. **Trust crypto, not your own.** Use the existing `nacl` primitives or
   another well-audited library. Do not write custom cryptography.
3. **Keep the static surface small.** No build step, no transpiler, no
   framework. The frontend is plain ES2022 served from `public/`.
4. **Tests must accompany behaviour changes.** Every protocol- or
   auth-relevant change should land with new cases in `tests/`.

## Local development

```bash
git clone https://github.com/repobility/cipherlink.git
cd cipherlink
npm install
npm test          # 22 tests across 3 suites
npm run lint
npm run format:check
npm run dev       # node --watch server.js
```

CI runs the same `npm test` matrix on Node 20 / 22 / 24, plus
`npm audit --omit=dev` and a `node --check` syntax pass.

## Project layout

| Path                       | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `server.js`                | Express + in-memory store. Factory + helpers exported.       |
| `public/index.html`        | Compose page. Strict CSP, no-referrer.                       |
| `public/view.html`         | Viewer page. Strict CSP, no-referrer.                        |
| `public/app.js`            | Compose flow: encrypt, POST, build URL with fragment key.    |
| `public/view.js`           | Viewer flow: peek meta, confirm, consume + decrypt.          |
| `public/crypto-utils.js`   | `nacl.secretbox` wrapper — keygen, encrypt, decrypt, b64url. |
| `public/app.css`           | UI styles.                                                   |
| `tests/crypto.test.js`     | Crypto-layer unit tests via Node `vm` sandbox.               |
| `tests/server.test.js`     | Boots the server and exercises the HTTP API.                 |
| `tests/auth.test.js`       | AUTH-\* cases — capability-URL invariants.                   |
| `.repobility/access.yml`   | Endpoint-by-endpoint authorization matrix.                   |
| `.github/workflows/ci.yml` | CI: matrix tests, audit, syntax check.                       |
| `docs/`                    | Repobility scan output, ADRs, protocol spec.                 |

## Style

- 2-space indentation, single quotes, semicolons, trailing commas in
  multi-line literals.
- No `innerHTML` with user-influenced content. Use `textContent` and
  `createElement`.
- All randomness goes through `crypto.getRandomValues` (browser) or
  `nacl.randomBytes` (anywhere) — never `Math.random` in
  security-adjacent code.
- Comment the _why_, not the _what_. If the code is obvious, leave it alone.

## Pull-request checklist

- [ ] `npm test` passes locally.
- [ ] Wire-protocol or threat-model changes update `SECURITY.md` and
      `.repobility/access.yml`.
- [ ] User-visible changes update `README.md` and `CHANGELOG.md`.
- [ ] No new third-party origins in `index.html` / `view.html` (CSP must
      stay tight).

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please do **not** file public issues for
vulnerabilities — email the maintainer first so a fix can be coordinated
before disclosure.
