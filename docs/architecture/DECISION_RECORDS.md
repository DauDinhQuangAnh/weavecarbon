# WeaveCarbon Architecture Decision Records

These decisions are accepted for the M5 release candidate. Reversing one requires a new ADR, compatible migration and the same release gates; editing history in place is not allowed.

## ADR-001 — Backend carbon authority

- Status: Accepted
- Decision: The backend carbon core is the only authority for persisted and official carbon outputs. Browser calculations are previews and are discarded/recomputed on write.
- Consequence: API responses and reports reference backend-generated methodology, engine and factor metadata; frontend changes cannot silently alter official history.

## ADR-002 — Immutable calculation and factor versions

- Status: Accepted
- Decision: Each authoritative result stores canonical input, factor snapshot, engine/methodology/factor-registry versions, GWP basis, timestamp and input hash. Published factor versions and calculation snapshots are immutable.
- Consequence: Corrections create a new version; they never rewrite a historical result.

## ADR-003 — Tenant model

- Status: Accepted
- Decision: `company_id` is the tenant boundary. JWT tenant claims are accepted only with active database membership; repositories scope reads and writes by tenant, and mutation permissions are checked server-side.
- Consequence: Cross-tenant shortcuts, client-selected ownership and unscoped repository methods are prohibited.

## ADR-004 — Durable job queue

- Status: Accepted
- Decision: PostgreSQL `operational_jobs` owns report and large-import work, idempotency, leases, retries and dead-job retention. In-process execution is a worker, not the durable source of truth.
- Consequence: A process restart recovers unfinished jobs; queue status and backlog remain observable and tenant-scoped.

## ADR-005 — Vector-store durability

- Status: Accepted
- Decision: Original evidence plus PostgreSQL metadata are preferred recovery sources. Chroma data is included in backups because legacy originals may be unavailable; rebuild/reindex is allowed only from durable, authorized sources.
- Consequence: `rag_data` is treated as recoverable secondary state, never as the sole new evidence store.

## ADR-006 — RAG trust boundary

- Status: Accepted
- Decision: Browsers call the backend proxy. Direct RAG operations require the internal API key, strict origin policy, tenant-aware backend authorization, upload validation and separate expensive-operation limits.
- Consequence: RAG is not a public unauthenticated API and its internal key is never sent to clients.

## ADR-007 — Cache policy

- Status: Accepted
- Decision: Dashboard and stable reference caches are process-local, bounded by TTL and tenant-aware keys. Mutations invalidate related tenant entries; cache loss must never affect correctness.
- Consequence: A cache is an optimization only. Shared caching requires a later ADR and explicit invalidation semantics.

## ADR-008 — Deployment and rollback

- Status: Accepted
- Decision: GitHub Actions builds scanned, non-root immutable images identified by digest. The VPS pulls those images, applies additive migrations, checks readiness and rolls back to the previous image on smoke failure. PostgreSQL and internal services are not directly published.
- Consequence: A source SHA, image digest, CI evidence and deployment history are required for release provenance.
