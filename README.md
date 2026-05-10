# Cipherlink

End-to-end encrypted one-time secret sharing. Drop a secret into a textbox, get a URL. Open the URL once — see the secret, server copy is gone forever.

- **Encryption** — NaCl `secretbox` (XSalsa20 + Poly1305). 32-byte key generated in the browser.
- **Key handling** — the key lives in the URL fragment (`#k=…`). Browsers never send fragments in HTTP requests, so the server cannot learn the key even from logs.
- **Server** — Express + an in-memory store with TTL and read-count limits. Holds only ciphertext + nonce + metadata.
- **Trust model** — if the server operator is malicious they learn that *a* secret of *some size* existed for *some duration*, but cannot read it.

## Quick start

```bash
git clone https://github.com/repobility/cipherlink.git
cd cipherlink
npm install
npm start
```

Open <http://127.0.0.1:3000>, paste a secret, copy the URL, share it.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/api/secrets` | `{ ciphertext, nonce, ttlSeconds, maxReads }` | `{ id, expiresAt, readsRemaining }` |
| `GET`  | `/api/secrets/:id` | — | `{ ciphertext, nonce, expiresAt, remaining }` and decrements the read counter |
| `GET`  | `/api/secrets/:id/meta` | — | non-consuming peek at expiry + read count |
| `GET`  | `/s/:id` | — | viewer page (key parsed from URL fragment client-side) |
| `GET`  | `/healthz` | — | liveness probe |

## License

MIT.
