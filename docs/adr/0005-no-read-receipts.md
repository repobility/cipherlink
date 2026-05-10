# ADR 0005 — No read receipts or analytics

- **Status**: Accepted
- **Date**: 2026-05-10

## Context

Most one-time-secret tools offer some form of read notification: an
email, a webhook, or an "I see when you opened it" indicator for the
creator. It is a frequently-requested feature.

## Decision

Cipherlink does not offer read receipts. The creator cannot learn —
from the service — whether or when their secret was read.

## Rationale

- The recipient's privacy outweighs the creator's curiosity. A read
  receipt forces every reader into a tracking system; many recipients
  read secrets in security-sensitive contexts (an incident-response
  shell, a journalist behind Tor) where being identified by IP at a
  specific moment is harmful.
- The creator can already infer the outcome out-of-band: the recipient
  acks via the channel they were sent the URL on, or the creator
  rotates the secret if it has not been confirmed within a window.
- Adding read receipts would either (a) require an account for the
  creator (kills ADR-0002) or (b) attach a long-lived creator token
  to each secret, which becomes a new credential to protect.

## Consequences

- The `/healthz` endpoint reports only a count of stored records, no
  per-record state.
- The creator-facing UI shows the URL and the configured TTL +
  max-reads, never an "opened at" stamp.
- Operators must keep server logs minimal: even per-fetch IP logs would
  effectively become a read receipt for anyone who can read the logs.
  Cipherlink's default logging emits the listen banner and nothing
  per-request.
