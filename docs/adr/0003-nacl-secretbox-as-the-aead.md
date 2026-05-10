# ADR 0003 — NaCl `secretbox` as the AEAD primitive

- **Status**: Accepted
- **Date**: 2026-05-10

## Context

Cipherlink needs symmetric authenticated-encryption-with-associated-data:
a 32-byte key encrypts a plaintext to a ciphertext that an adversary
cannot decrypt without the key and cannot tamper with undetectably.

We do not need key agreement (the recipient learns the key from the
URL fragment, not from a handshake), so a public-key construction like
`nacl.box` would be overkill.

## Decision

We use [`nacl.secretbox`](https://nacl.cr.yp.to/secretbox.html) via
[TweetNaCl 1.0.3](https://github.com/dchest/tweetnacl-js):

- **XSalsa20** with the 32-byte key and a fresh 24-byte random nonce.
- **Poly1305** authenticator over the ciphertext.

The library is ~3 KB minified, audited by Cure53 in 2017, and ships
identical APIs in the browser and in Node — so tests can exercise the
same code path end users hit.

## Considered alternatives

- **Web Crypto's AES-GCM**: standards-blessed and hardware-accelerated
  on most platforms. But the dual-environment (Node tests + browser)
  story would require either Node 22's still-fresh `crypto.subtle` or
  a polyfill. With TweetNaCl we get a single audited primitive
  everywhere. Performance is not a bottleneck — secrets are typically
  a few hundred bytes, not megabytes.
- **`nacl.box`** (X25519 ECDH + secretbox): unnecessary. We are not
  doing key agreement; the recipient receives the symmetric key in
  the URL fragment.
- **AES-GCM with a passphrase-derived key**: feasible (Argon2 / scrypt
  → 32-byte key → AES-GCM), but introduces a passphrase coordination
  problem that defeats the "send a URL and you're done" UX.

## Consequences

- Confidentiality and integrity hold against any adversary who does
  not hold the 32-byte key.
- The browser bundle has zero crypto-related third-party origins.
- If a serious vulnerability is found in `secretbox`, the
  cryptographic surface is small enough (one module, two call sites:
  `encryptSecret`, `decryptSecret`) to swap out in a single PR.
