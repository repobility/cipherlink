<!-- Thanks for contributing! Keep the trust model intact. -->

## Summary

<!-- One paragraph: what changed and why. Link the issue if there is one. -->

## Trust-model impact

- [ ] No change. (Pure refactor, docs, or UI tweak.)
- [ ] Touches the wire protocol — `SECURITY.md` and `.repobility/access.yml` are updated.
- [ ] Touches the server validation rules — added/updated tests in `tests/server.test.js`.
- [ ] Touches the cryptographic core — added/updated tests in `tests/crypto.test.js`.
- [ ] Changes the capability-URL contract — `.repobility/access.yml` is updated and `tests/auth.test.js` covers the new behavior.

## Checklist

- [ ] `npm test` passes locally on Node 20+.
- [ ] No new third-party origins added to `index.html` / `view.html` (CSP must stay tight).
- [ ] Browser code uses `crypto.getRandomValues` / `nacl.randomBytes` — no `Math.random` in security-adjacent code.
- [ ] Display strings use `textContent`, not `innerHTML`.
- [ ] User-visible changes noted in `CHANGELOG.md` under `[Unreleased]`.

## Test plan

<!-- How did you verify this? Two-window manual check, curl against the API,
     automated tests, etc. -->
