# ADR 0004 — No persistent storage, in-memory only

- **Status**: Accepted
- **Date**: 2026-05-10

## Context

Cipherlink could persist secret records to SQLite, Postgres, Redis, or
disk. The choice affects:

- the operator's exposure to subpoenas and breaches (anything on disk
  is preserved over a restart and discoverable in backups);
- developer experience (a clean restart should be a clean slate);
- horizontal scaling (multiple replicas need shared state).

## Decision

v1 stores secret records only in process memory. A process restart
clears the store. There is no database, no disk file, no cache layer.

## Rationale

- The records are bounded — TTLs are clamped to 7 days, and most reads
  consume their record. A normal workload has a few thousand pending
  secrets at most; a `Map` keyed by 22-char ids handles this trivially.
- Server-side breach surface is minimised: a stolen disk reveals
  nothing because nothing is on disk. A live memory dump reveals only
  ciphertext (still useless without the URL-fragment key) and
  metadata (timestamps, sizes).
- The simpler the substrate, the easier to audit. There is no schema,
  no migration story, no eventual-consistency window.

## Consequences

- A relay restart drops every pending secret. Recipients of unfetched
  URLs get a 404. This is documented in the SLA expectations and
  visible to operators via `/healthz` returning a low `stored` count.
- Cannot horizontally scale beyond one process without sticky routing.
  Multi-replica deployments need an external store (Redis with the
  same atomic-decrement contract). Out of scope for v1.
- If durability becomes a requirement, a future ADR will introduce
  an encrypted-at-rest backing store. The application-layer encryption
  means even disk-resident records remain useless to the operator.
