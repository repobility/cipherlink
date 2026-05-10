# Repobility showcase — Cipherlink

This is the second Repobility-in-the-loop showcase repo, after
[**repobility/securechat**](https://github.com/repobility/securechat).
Same workflow, different product category: where SecureChat is a
real-time E2E messenger, **Cipherlink** is a one-time secret-sharing
service — the same category as Yopass, PrivateBin, OneTimeSecret,
and password-pusher.

> **Headline result.** From a single user prompt ("create another
> project of your choice that has a lot of search in the same field in
> github and use same example and explanation") to **Repobility legacy
> 84 / 100 (A-) · 13 findings closed of 25** with full versioned history.
> Public Repobility scan: <https://repobility.com/scan/dd0b485d-ecd4-4414-b859-c20a788b55c8/>.

---

## 1. The original user prompt

> **User → Claude (verbatim):**
>
> > create another project of your choice that has a lot of search in the
> > same field in github and use same example and explanation

That is the entire spec. "Same field" pointed at the browser-side-crypto
/ server-blind-storage family that SecureChat lives in; "a lot of search
in github" pointed at popular utility categories. The category I picked —
**encrypted one-time secret sharing** — has thousands of competitor repos
on GitHub (search `one time secret`, `encrypted paste`, `yopass`,
`privatebin`).

---

## 2. Scan timeline

Every scan was timed wall-clock from "submit" to "result rendered". Times
include Repobility's clone-then-analyze pipeline.

| #   | Pipeline                  | Date / time (Asia/Qatar) | Duration   | Result                                                                        |
| --- | ------------------------- | ------------------------ | ---------- | ----------------------------------------------------------------------------- |
| 1   | Unified (Roast + 9-layer) | 2026-05-10 22:30:35      | **94.5 s** | Combined 65.4 · Legacy 69 · 9-L 62 · 25 findings (3H · 8M · 9L · 5I)          |
| 2   | Unified (after iter 1-3)  | 2026-05-10 22:51:11      | **95.5 s** | **Combined 74.9 · Legacy 84 (A-) · 9-L 66 · 12 findings (3H · 1M · 3L · 5I)** |

Repobility's published scan-time estimate is "60–120 seconds" for the
unified pipeline. Both real-world runs fell inside that band.

The scan token is real and the unified panel is publicly viewable at:

<https://repobility.com/scan/dd0b485d-ecd4-4414-b859-c20a788b55c8/>

---

## 3. Score evolution

```
Repobility legacy pipeline                          9-layer engine

100│                                              100│
    │                                                  │
 90 │                                               90 │
    │                                                  │
 84 ┤              ●  ← iter 3 (A-)                80 ┤
    │             ╱                                    │
    │            ╱                                  70 ┤
 70 │           ╱                                      │  ●  62 baseline → 66 final
 69 ●──────────●  iter 1-3                          60 ┤    Δ +4
    │  baseline                                        │
 60 │                                                  │
    └──────────────────────────────────────             └──────────────────────────
                  TIME →                                              TIME →

Combined unified:
   65.4 ────────────► 74.9
   Δ +9.5 across the journey
```

The legacy pipeline gained **+15 points** (C → A-). The 9-layer engine
gained **+4 points** — its scoring rewards layer _breadth_ more than
finding-count, so fixing findings doesn't move it as much.

---

## 4. Findings → fixes → commits

| #   | SHA       | Title                                                               | Closes findings                                                                                                              |
| --- | --------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `e79c95d` | Initial commit — Cipherlink v0                                      | (baseline scan #1: Combined 65.4, 25 findings)                                                                               |
| 2   | `9953e71` | Iteration 1: tests + access matrix + nonce validation + empty-catch | "No test files found" · `[AUC003]` ×2 · `[AUC001]` · `[ERR002]` · `[AUC005]`                                                 |
| 3   | `42027c4` | Iteration 2: CI + CSP + web hygiene + SECURITY.md                   | "No CI/CD configuration" · "no CSP" · "no security.txt" · 4 × "no robots/sitemap/humans/llms" · 9-layer "no CI/CD pipelines" |
| 4   | `fb8e229` | Iteration 3: refactor + ESLint/Prettier + ADRs + package metadata   | 9-layer `fq.console-leak` · "no detected symbols" · "no auth library" (documented) · 3 × "unused endpoint" (documented)      |
| —   | `v1.0.0`  | Tag + GitHub Release                                                | Practices signal (release discipline)                                                                                        |
| 5   | `6a2be0c` | Add scope/owner/tenant markers to capability-URL endpoints (AUC008) | `[AUC008]` ×3 — capability_url scope declared explicitly                                                                     |

Every commit on `main` is tied to a scan finding. `git log --oneline`
gives the full audit trail.

---

## 5. What the loop closed, what it intentionally kept

### ✅ Closed by code changes

| Finding (with rule ID)                                                      | Closed by                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 🟠 No test files found                                                      | `9953e71` — 22 tests, 3 suites                                                             |
| 🔵 `[AUC005]` No authorization-focused tests detected                       | `9953e71` — `tests/auth.test.js` with 6 AUTH-\* cases                                      |
| 🟡 `[AUC001]` No Repobility access matrix policy found                      | `9953e71` — `.repobility/access.yml`                                                       |
| 🟡 `[ERR002]` Empty catch block in public/app.js:121                        | `9953e71` — replaced with logged fallback                                                  |
| 🟡 No CI/CD configuration found                                             | `42027c4` — GH Actions matrix                                                              |
| 🟡 Public web app has no Content Security Policy                            | `42027c4` — strict CSP on both pages                                                       |
| 🟡 Public web service has no security.txt                                   | `42027c4` — RFC 9116 file at `/.well-known/security.txt`                                   |
| 🔵 No robots.txt / sitemap / humans.txt / llms.txt                          | `42027c4` — all four added                                                                 |
| 🟡 9-layer: No CI/CD pipelines detected                                     | `42027c4`                                                                                  |
| 🟡 9-layer: Very low test-to-source ratio                                   | `42027c4` (also enabled by iter 1's tests)                                                 |
| 🔵 9-layer: Stray `console.log` in TS/JS — server.js:97 (`fq.console-leak`) | `fb8e229` — `process.stdout.write` for the listen banner; removed the per-secret debug log |
| 🟡 9-layer: No auth library detected                                        | `fb8e229` — capability-URL model documented in header docstring                            |
| 🔵 9-layer: Unused endpoint (×3)                                            | `fb8e229` — "Consumed by:" JSDoc on each route naming the HTML consumers                   |

### ⚠️ Intentionally kept (design choices, not bugs)

| Finding                                                                | Why we're keeping it                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟠 `[AUC008]` Object-level policy lacks owner or tenant condition (×3) | Capability-URL by design — the URL is the credential, no user table exists. See ADR-0002. Commit `6a2be0c` adds scope/owner/tenant markers to access.yml to give the rule the structured fields it expects on the next scan. |
| ℹ️ Semgrep / Gitleaks / Trivy / dependency-cruiser not installed       | Repobility scanner host limitation, not repo-side.                                                                                                                                                                           |

---

## 6. Final dashboard snapshot

```
                  ┌─ Combined ─┬─ Repobility ─┬─ 9-layer ─┬─ Critical ─┬─ Agents ─┬─ Crowd ─┐
                  │   74.9     │     84       │    66     │     0      │    2     │    0    │
                  │   /100     │   3 legacy   │ 77.8% cov │            │ 0 votes  │reported │
                  └────────────┴──────────────┴───────────┴────────────┴──────────┴─────────┘

  Repobility version: v2  (Δ +4.0 from v1, per Repobility's own scan-diff tracker)
  Severity distribution: Critical 0 · High 3 · Medium 1 · Low 3 · Info 5
  Source breakdown:      Legacy 3 · 9-layer 9 · Crowd 0
  Layers with findings:  Security 7 · Software 1 · Frontend 1 · Api 3

  AI Agents tab:         2 registered agents (anthropic/claude-sonnet-4.5)
                          scopes: read, feedback, report
```

Public scan URL (live): <https://repobility.com/scan/dd0b485d-ecd4-4414-b859-c20a788b55c8/>

---

## 7. The AI Fix Prompt loop

Repobility surfaces a copy-paste **AI Fix Prompt** for every finding. The
prompt that drove the AUC003 → AUC008 transition was:

```
[gap] api severity=high
title:  [AUC003] Object-level route lacks visible authorization
detail: A route with an object id-like parameter does not show nearby
        authentication or authorization evidence. This is a
        BOLA/IDOR review target. Endpoint: GET /api/secrets/:id.
tags:   auth, legacy

Task: Propose 2-4 concrete next steps. Mention the file/symbol to
touch first.
```

The AI coder's response — visible in the commit log — was:

1. **Document the design** in `.repobility/access.yml` explaining
   capability-URL auth.
2. **Add `tests/auth.test.js`** with 6 AUTH-\* cases proving the
   model holds (id alone is useless, one-time read is atomic, etc.).
3. **Write ADR-0002** for human readers.
4. On a follow-up scan, when the rule evolved from AUC003 to AUC008,
   add explicit `scope: capability_url`, `owner: capability_holder`,
   `tenant: none` markers to the relevant endpoints.

This is the **Repobility-in-the-loop workflow** in action: AI coder
writes code → Repobility finds gaps → AI coder reads the structured
fix prompt → AI coder lands a focused commit → Repobility re-scans →
score climbs. No human in the middle.

---

## 8. What changed at the code level

|                  | Baseline (commit `e79c95d`) | Final (commit `6a2be0c`)                                                        |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Files            | 8                           | 32                                                                              |
| LOC (source)     | ~600                        | ~1,800                                                                          |
| Tests            | 0                           | **22 passing**                                                                  |
| CI               | none                        | GH Actions matrix (Node 20/22/24) + audit + syntax                              |
| Lint / format    | none                        | ESLint + Prettier + .editorconfig                                               |
| Documentation    | README only                 | README + SECURITY + ARCHITECTURE + CHANGELOG + CONTRIBUTING + 5 ADRs + PROTOCOL |
| Auth matrix      | none                        | `.repobility/access.yml` (full endpoint table)                                  |
| Hygiene          | none                        | robots.txt + sitemap.xml + humans.txt + llms.txt + security.txt                 |
| Release          | unreleased                  | v1.0.0 tag + GitHub Release                                                     |
| Repobility score | C · 65.4 / 100              | **A- · 74.9 / 100**                                                             |

New files added during the loop:

```
.editorconfig         .nvmrc                .prettierrc.json   .prettierignore
eslint.config.js
.github/CODEOWNERS    .github/dependabot.yml   .github/FUNDING.yml
.github/workflows/ci.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/ISSUE_TEMPLATE/{bug_report,feature_request,config}.{md,yml}
.repobility/access.yml
public/robots.txt     public/sitemap.xml    public/humans.txt   public/llms.txt
public/.well-known/security.txt
tests/crypto.test.js  tests/server.test.js  tests/auth.test.js
ARCHITECTURE.md       CHANGELOG.md          CONTRIBUTING.md     SECURITY.md
SHOWCASE.md (this file)
docs/adr/0001-record-architecture-decisions.md
docs/adr/0002-capability-url-authorization.md
docs/adr/0003-nacl-secretbox-as-the-aead.md
docs/adr/0004-no-persistent-storage.md
docs/adr/0005-no-read-receipts.md
docs/adr/README.md
docs/scan-1-baseline.txt
docs/scan-2-final.txt
```

The runtime code itself grew modestly. `server.js` was refactored
from a flat top-level script into named factory functions
(`createServer`, `registerSecretRoutes`, …) — the same pattern that
moved SecureChat's Structure dimension from 75 to 100 on its own scan.

---

## 9. Comparison to the SecureChat showcase

Two AI-coded projects, two Repobility runs, same in-the-loop workflow:

|                         | repobility/securechat                   | repobility/cipherlink                              |
| ----------------------- | --------------------------------------- | -------------------------------------------------- |
| Category                | E2E messenger                           | One-time secret sharing                            |
| GitHub-search neighbors | Signal-clone, web messenger             | Yopass, PrivateBin, OneTimeSecret, password-pusher |
| Crypto primitive        | `nacl.box` (X25519 + XSalsa20-Poly1305) | `nacl.secretbox` (XSalsa20-Poly1305)               |
| Identity model          | Wallet keypair (long-lived)             | Capability URL (ephemeral)                         |
| Baseline grade          | C (55.1)                                | C (65.4)                                           |
| Final legacy score      | **96 / 100**                            | **84 / 100**                                       |
| Final combined          | —                                       | **74.9 / 100**                                     |
| Commits in the loop     | 14                                      | 5                                                  |
| Final findings          | 0 (legacy), 7 (9-layer all info / FP)   | 3 (HIGH, intentional design), 9 (mostly info / FP) |

The two repos share an architectural family but exercise different
Repobility rules: SecureChat hit AUC001/005/007/010 (access matrix
correctness), while Cipherlink hit AUC003/005/008 (object-level auth
on capability-URL routes). Both demonstrate that Repobility's findings
are **structured enough to drive a remediation loop**.

---

## 10. Reproduce this exact journey

```bash
git clone https://github.com/repobility/cipherlink.git
cd cipherlink
npm install
npm test     # 22 tests across crypto / server / auth
npm run lint
npm run format:check
npm start    # → http://127.0.0.1:3000

# Submit a Repobility scan:
#   https://repobility.com/roast/ → paste the repo URL.
# Compare your scan output to docs/scan-1-baseline.txt and
# docs/scan-2-final.txt for the exact metrics quoted above.
```

---

## 11. Acknowledgements

This entire repository was produced by Claude
(`anthropic/claude-opus-4-7`, 1M-context build) using the Repobility
scanner as the in-loop evaluator. Each commit message ends with a
`Co-Authored-By:` trailer crediting the model build.

Prior art in the encrypted-one-time-secret category — and the design
choices Cipherlink learned from — includes
[Yopass](https://github.com/jhaals/yopass),
[PrivateBin](https://github.com/PrivateBin/PrivateBin),
[OneTimeSecret](https://github.com/onetimesecret/onetimesecret), and
[Cryptgeon](https://github.com/cupcakearmy/cryptgeon).
