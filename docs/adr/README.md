# Architecture Decision Records

This directory holds the long-form rationale for Cipherlink's
non-obvious architectural choices. The format follows
[Cognitect's ADR convention](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

| ADR                                           | Title                                     | Status   |
| --------------------------------------------- | ----------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions             | Accepted |
| [0002](0002-capability-url-authorization.md)  | Capability URL as the authorization model | Accepted |
| [0003](0003-nacl-secretbox-as-the-aead.md)    | NaCl `secretbox` as the AEAD primitive    | Accepted |
| [0004](0004-no-persistent-storage.md)         | No persistent storage, in-memory only     | Accepted |
| [0005](0005-no-read-receipts.md)              | No read receipts or analytics             | Accepted |

When you change a load-bearing decision (the wire protocol, the auth
model, the cryptographic primitive, the storage substrate), please add
a new ADR rather than editing an existing one. ADRs are immutable
once accepted; superseding decisions get their own number and link back.
