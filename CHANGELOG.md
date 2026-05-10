# Changelog

All notable changes to Cipherlink are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-05-10

### Added

- Initial release.
- End-to-end encrypted one-time secret sharing using NaCl `secretbox`
  (XSalsa20 + Poly1305). 32-byte symmetric key generated in the browser
  and transmitted only in the URL fragment.
- Express server with an in-memory store, TTL clamping, per-record
  read-count limits, and a periodic sweep.
- `/api/secrets` create + read (consuming) + meta (non-consuming) endpoints.
- `/s/<id>` viewer SPA shell with a confirm-then-consume flow.
- Strict Content-Security-Policy on both pages; `<meta name="referrer"
content="no-referrer">` so the view page does not leak the URL via Referer.
- Node native test runner suites: 22 tests across crypto, server, and
  capability-URL authorization invariants.
- `.repobility/access.yml` documenting the capability-URL authorization
  model end-to-end.
- GitHub Actions CI: test matrix on Node 20 / 22 / 24, `npm audit` on
  production deps, and a `node --check` syntax pass over every source file.
- Web hygiene files: `robots.txt`, `sitemap.xml`, `humans.txt`, `llms.txt`,
  and `/.well-known/security.txt` (RFC 9116).
- `SECURITY.md` with the full threat model.
- `CONTRIBUTING.md`, `ARCHITECTURE.md`, ADRs under `docs/adr/`.
- ESLint flat config with Node and browser layers; Prettier for formatting.
- Dependabot weekly updates for npm + GitHub Actions; CODEOWNERS; PR and
  issue templates with a security-vulnerability call-out.

[1.0.0]: https://github.com/repobility/cipherlink/releases/tag/v1.0.0
