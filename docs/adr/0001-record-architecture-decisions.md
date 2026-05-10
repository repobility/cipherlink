# ADR 0001 — Record architecture decisions

- **Status**: Accepted
- **Date**: 2026-05-10

## Context

Cipherlink makes several non-obvious choices (no persistent storage, no
read receipts, capability URL instead of accounts). Future contributors
and security reviewers need the _why_ of each, so that proposed changes
can be evaluated against the original constraints.

## Decision

We record significant architectural decisions as
[Architecture Decision Records](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
under [`docs/adr/`](.). Each record:

- has a short imperative title prefixed by a four-digit number;
- captures **Context**, **Decision**, and **Consequences**;
- is immutable once accepted — superseded decisions get a new record
  with a `Superseded by ADR-NNNN` link instead of edits in place.

## Consequences

- Reviewers reading a PR that touches the wire protocol, the auth
  model, or the cryptographic core can find the relevant ADR and cite
  it.
- Out-of-date ADRs are explicitly visible (status: `Superseded`)
  instead of silently dropped.
- The act of writing the ADR forces the author to articulate trade-offs.
