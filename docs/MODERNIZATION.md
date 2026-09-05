# WeaveCarbon Modernization Summary

The consolidated modernization program closed on 2026-09-05. Detailed work-package notes and point-in-time baselines were removed from the active source tree after completion; Git history remains the audit trail.

## Final status

| Phase | Scope | Status |
| --- | --- | --- |
| M1 | Backend data integrity, carbon authority and security | PASS |
| M2 | Frontend boundaries, shared transport and performance | PASS |
| M3 | RAG runtime, evaluation and retrieval quality | PASS |
| M4 | Durable jobs, observability, containers and CI/CD | PRODUCTION PASS |
| M5 | Performance, recovery and release-readiness controls | IMPLEMENTATION COMPLETE; STAGING DEFERRED |

No planned implementation phase remains. Production health and deployment workflows passed at closeout. Formal release certification remains `NOT READY` until the full isolated staging workflow supplies capacity, performance, RPO and RTO evidence.

## Delivered platform controls

- Backend-owned carbon calculations with versioned factors, provenance and immutable snapshots.
- Tenant-scoped authorization, hardened authentication, bounded database behavior and durable report jobs.
- Generated OpenAPI transport boundaries and a bounded, invalidation-aware frontend HTTP client.
- Private backend-to-RAG authentication, deterministic retrieval evaluation and citation invariants.
- Immutable release images, private Compose networks, health checks, rollback, SBOM/provenance and cross-repository CI.
- Structured logs, correlation IDs, metrics, operational snapshots, complete state backups and an isolated restore drill.

## Verification and release boundary

Use `npm run verify:full` for the frontend, `npm run verify:full` for the backend, and the RAG pytest/evaluation workflow for local and CI regression gates. The manual `M5 Release Readiness` workflow is the only path that may issue a release `PASS`.

The workflow's `deferred` mode records exact-head CI completion but always produces `NOT READY`. Before commercial launch, material traffic growth or a high-risk state migration, provision isolated staging and run `full` mode.

## Active documentation

- `README.md` — product and frontend development entry point.
- `deploy/CI_CD.md` — image and VPS deployment configuration.
- `docs/operations/RUNBOOKS.md` — incident, rollback and recovery procedures.
- `docs/operations/DISASTER_RECOVERY_POLICY.md` — durable state and recovery policy.
- `docs/architecture/DECISION_RECORDS.md` — accepted architecture decisions.
- `RELEASE_READINESS.md` — current release decision.
