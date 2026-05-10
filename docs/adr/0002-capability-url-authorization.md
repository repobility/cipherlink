# ADR 0002 — Capability URL as the authorization model

- **Status**: Accepted
- **Date**: 2026-05-10

## Context

A one-time secret-sharing service needs _some_ way to scope who can
read a secret. Conventional options:

- **Accounts + ACL**: the creator picks specific recipients, who log
  in and the server checks identity. Heavy: needs user database,
  password reset, session tokens, email verification.
- **Pre-shared secret**: creator and recipient agree on a passphrase
  out of band; the secret is encrypted with a KDF of it. Pushes the
  same coordination problem we are trying to solve onto the user.
- **Capability URL**: the URL itself is the credential. Anyone who has
  the URL can read the secret; anyone who doesn't, can't.

## Decision

Cipherlink uses a **capability URL** of the form

```
https://host/s/<id>#k=<urlsafe-base64-key>
```

- `id` is 16 random bytes, urlsafe-base64-encoded. It is the database
  key. ~128-bit search space.
- `k` is a 32-byte symmetric key, generated client-side with
  `nacl.randomBytes(32)`. It lives in the URL fragment.

The browser **never** sends the fragment to the server in HTTP. The
server cannot learn the key — even from its own logs, even if
compromised. Possession of the _complete_ URL is the credential.
There is no user table, no session, no role.

## Rationale

- Removes the need for accounts, password resets, email verification —
  a one-time secret should not require a multi-step onboarding flow.
- Aligns with widely-deployed prior art: Yopass, PrivateBin,
  OneTimeSecret, Cryptgeon — all use capability URLs.
- The threat surface shrinks dramatically: there is no auth code that
  can have a bug. The server treats every reader equally; only the
  URL distinguishes who can decrypt.

## Consequences

- A leaked URL is a leaked secret. Browser history, channel of
  distribution, screen-share — all become exfiltration vectors. We
  mitigate the dominant case (re-read from history) by making
  one-time-read the default; once consumed, the URL is worthless.
- The creator has no way to retract or rotate after sending. To
  mitigate, TTL is enforced server-side and defaults to 24 h.
- Static analyzers that look for an auth middleware will flag every
  endpoint. We document the model explicitly in
  [`.repobility/access.yml`](../../.repobility/access.yml) so the
  AUC003 finding ties to a deliberate design choice rather than a bug.
