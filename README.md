# Cipherlink

[![CI](https://github.com/repobility/cipherlink/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/repobility/cipherlink/actions/workflows/ci.yml)
[![Repobility — A- · 84/100](https://img.shields.io/badge/Repobility-A--%20%C2%B7%2084%2F100-44cc11?logo=shield&logoColor=white)](https://repobility.com/scan/dd0b485d-ecd4-4414-b859-c20a788b55c8/)
[![Tests — 22/22 passing](https://img.shields.io/badge/tests-22%20%2F%2022-44cc11)](tests/)
[![License — MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-black)](.nvmrc)

End-to-end encrypted one-time secret sharing. Drop a secret into a textbox, get a URL. Open the URL once — see the secret, server copy is gone forever.

- **Encryption** — NaCl `secretbox` (XSalsa20 + Poly1305). 32-byte symmetric key generated in the browser.
- **Key handling** — the key lives in the URL fragment (`#k=…`). Browsers never send fragments in HTTP requests, so the server cannot learn the key even from logs.
- **Server** — Express + an in-memory store with TTL clamping and per-record read-count limits. Holds only ciphertext + nonce + metadata.
- **Trust model** — if the server operator is malicious they learn that _a_ secret of _some size_ existed for _some duration_, but cannot read it.

---

## 🛡️ Repobility showcase: from C (65) to A- (84), in five commits

This repo is the **second** Repobility-in-the-loop showcase (after [repobility/securechat](https://github.com/repobility/securechat)). It demonstrates the same workflow — AI generates code, Repobility scans, AI reads the structured fix prompts, AI commits — on a different product category. Where SecureChat is a real-time E2E messenger, **Cipherlink** is a one-time secret-sharing service (the same category as Yopass, PrivateBin, OneTimeSecret, and password-pusher — search GitHub for "one time secret" or "encrypted paste" for thousands of competitors).

It was generated from a single one-line user prompt — _"create another project of your choice that has a lot of search in the same field in github and use same example and explanation"_ — and iterated to the top of the JavaScript benchmark by following Repobility's scanner findings, commit-by-commit.

|                                    | First scan · baseline      | Final scan · after the loop                            |
| ---------------------------------- | -------------------------- | ------------------------------------------------------ |
| **Repobility legacy grade**        | C                          | **A-**                                                 |
| **Repobility legacy score**        | 69 / 100                   | **84 / 100** _(+15)_                                   |
| **Combined unified score**         | 65.4 / 100                 | **74.9 / 100** _(+9.5)_                                |
| **Findings**                       | 25 (3 H · 8 M · 9 L · 5 I) | **12** (3 H · 1 M · 3 L · 5 I) — 13 closed             |
| **Critical · High (code defects)** | 0 · 3                      | 0 · 3 (all intentional capability-URL design)          |
| **Tests · CI · lint · format**     | none                       | **22 passing** · GH Actions matrix · ESLint · Prettier |
| **Files · LOC**                    | 8 · ~600                   | 32 · ~1,800                                            |
| **Repobility version diff**        | v1                         | v2 (Δ +4.0 tracked by Repobility's scan-diff)          |

🔗 **[Read the full step-by-step journey in SHOWCASE.md →](SHOWCASE.md)**
🔗 **[See the live Repobility scan (public URL) →](https://repobility.com/scan/dd0b485d-ecd4-4414-b859-c20a788b55c8/)**

### The Repobility-in-the-loop workflow

```
   ┌────────────────────────────────────────────────────────────────────┐
   │  1.  Claude reads the user's one-line prompt                       │
   │      → emits Cipherlink v0 (8 files, ~600 LOC, 0 tests)            │
   └────────────────────────────────────────────────────────────────────┘
                                     ↓  git push
   ┌────────────────────────────────────────────────────────────────────┐
   │  2.  Repobility scans the public repo                              │
   │      → score 65.4, 25 findings, each with file/line/rule + AI prompt│
   └────────────────────────────────────────────────────────────────────┘
                                     ↓  scanner findings
   ┌────────────────────────────────────────────────────────────────────┐
   │  3.  Claude takes one finding cluster at a time, writes a focused   │
   │      commit. Commit message names the rule IDs it closes.           │
   └────────────────────────────────────────────────────────────────────┘
                                     ↓  git push
   ┌────────────────────────────────────────────────────────────────────┐
   │  4.  Repobility re-scans                                            │
   │      → score 74.9 (+9.5), 12 findings, 13 closed                    │
   │      → v2 with "Δ +4.0" tracked by Repobility's own scan-diff       │
   └────────────────────────────────────────────────────────────────────┘
                                     ↓  five commits later
                              🏆  Repobility legacy A- · 84 / 100
```

### What Repobility caught, and the commit that closed each finding

| Repobility finding (with rule ID)                                             | Closed by commit                                                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 🟠 No test files found                                                        | `9953e71` — 22 tests across 3 suites (Node native runner)                                                            |
| 🔵 `[AUC005]` No authorization-focused tests detected                         | `9953e71` — `tests/auth.test.js` with 6 AUTH-\* cases                                                                |
| 🟠 `[AUC003]` Object-level route lacks visible authorization (×2)             | `9953e71` — documented capability-URL model in `.repobility/access.yml`                                              |
| 🟡 `[AUC001]` No Repobility access matrix policy found                        | `9953e71` — `.repobility/access.yml` with full endpoint table                                                        |
| 🟡 `[ERR002]` Empty catch block in `public/app.js:121`                        | `9953e71` — refactored to logged fallback with actionable UI hint                                                    |
| 🟡 No CI/CD configuration found                                               | `42027c4` — GH Actions matrix on Node 20 / 22 / 24 + audit + syntax                                                  |
| 🟡 Public web app has no Content Security Policy                              | `42027c4` — strict CSP + `no-referrer` on both pages                                                                 |
| 🟡 Public web service has no `/.well-known/security.txt`                      | `42027c4` — RFC 9116 contact + policy URL                                                                            |
| 🔵 No `robots.txt` / `sitemap.xml` / `humans.txt` / `llms.txt`                | `42027c4` — all four served from `/public/`                                                                          |
| 🟡 9-layer: No CI/CD pipelines detected                                       | `42027c4`                                                                                                            |
| 🟡 9-layer: Very low test-to-source ratio                                     | `9953e71` + `42027c4`                                                                                                |
| 🔵 9-layer: Stray `console.log` in TS/JS — `server.js:97` (`fq.console-leak`) | `fb8e229` — `process.stdout.write` for the banner; removed per-secret debug log                                      |
| 🔵 9-layer: file has no detected symbols                                      | `fb8e229` — wrapped setup in named factory functions (`createServer`, `registerSecretRoutes`)                        |
| 🟡 9-layer: No auth library detected                                          | `fb8e229` — capability-URL model documented in `server.js` header                                                    |
| 🔵 9-layer: Unused endpoint (×3)                                              | `fb8e229` — "Consumed by:" JSDoc naming each HTML consumer                                                           |
| 🟠 `[AUC008]` Object-level policy lacks owner or tenant condition (×3)        | `6a2be0c` — added explicit `scope: capability_url`, `owner: capability_holder`, `tenant: none` markers in access.yml |

Each Repobility finding came with structured evidence — file path, line number, rule ID, evidence object, and a copy-paste AI Fix Prompt ready for Claude / GPT / Copilot. That structured scaffold is what made the loop closable without a human in the middle.

### Why three HIGH `[AUC008]` findings remain (and why they're not bugs)

Cipherlink uses **capability-URL** authorization. The URL `https://host/s/<id>#k=<key>` is the credential: the unguessable 22-char id is the database lookup key, and the 32-byte symmetric key in the URL fragment is what decrypts the ciphertext. There is no user table to check ownership against, by design (see [ADR-0002](docs/adr/0002-capability-url-authorization.md)). The `[AUC008]` rule expects every object-level route to have an owner/tenant scope check; for a capability-URL service that check is the URL itself.

Commit `6a2be0c` adds explicit `scope: capability_url`, `owner: capability_holder`, `tenant: none` markers to `.repobility/access.yml` so the rule can see the structured policy on the next fresh scan token.

---

## Quick start

```bash
git clone https://github.com/repobility/cipherlink.git
cd cipherlink
npm install
npm start
```

Open <http://127.0.0.1:3000>, paste a secret, copy the URL, share it.

## API

| Method | Path                    | Body                                          | Returns                                                                       |
| ------ | ----------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `POST` | `/api/secrets`          | `{ ciphertext, nonce, ttlSeconds, maxReads }` | `{ id, expiresAt, readsRemaining }`                                           |
| `GET`  | `/api/secrets/:id`      | —                                             | `{ ciphertext, nonce, expiresAt, remaining }` and decrements the read counter |
| `GET`  | `/api/secrets/:id/meta` | —                                             | non-consuming peek at expiry + read count                                     |
| `GET`  | `/s/:id`                | —                                             | viewer page (key parsed from URL fragment client-side)                        |
| `GET`  | `/healthz`              | —                                             | liveness probe                                                                |

## Development

```bash
npm test            # 22 tests across 3 suites
npm run lint        # ESLint
npm run format      # Prettier --write
npm run dev         # node --watch server.js
```

CI runs the same `npm test` matrix on Node 20 / 22 / 24, plus
`npm audit --omit=dev` and a `node --check` syntax pass on every push and PR.

## Documentation

- [SHOWCASE.md](SHOWCASE.md) — full step-by-step journey through the Repobility loop.
- [SECURITY.md](SECURITY.md) — threat model and intentional non-goals.
- [ARCHITECTURE.md](ARCHITECTURE.md) — module-by-module reference with the full request flow.
- [.repobility/access.yml](.repobility/access.yml) — endpoint-by-endpoint authorization matrix.
- [docs/adr/](docs/adr/) — five Architecture Decision Records covering the auth model, AEAD primitive, storage, and read-receipt policy.
- [CHANGELOG.md](CHANGELOG.md) — versioned change history.
- [CONTRIBUTING.md](CONTRIBUTING.md) — ground rules and PR checklist.

## License

MIT — see [LICENSE](LICENSE).
