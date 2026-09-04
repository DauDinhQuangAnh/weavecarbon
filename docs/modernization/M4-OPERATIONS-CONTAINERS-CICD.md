# M4 — Operations, Containers and CI/CD Platform

Status: LOCAL PASS; workflow and production evidence pending the coordinated main
push for frontend, backend and RAG.

## Acceptance matrix

| Gate | Implementation | Evidence |
| --- | --- | --- |
| Durable work | PostgreSQL queue for reports, evidence/RAG ingest and large product imports | Backend unit suite plus disposable-PostgreSQL restart/idempotency/retry/dead-job drill |
| Observability | Correlation propagation, JSON/redacted logs, liveness/readiness and Prometheus metrics | Backend and RAG policy tests |
| Cache semantics | Named owner/version/TTL/invalidation and hit/miss metrics | Backend TTL and RAG embedding-cache tests |
| Containers | Non-root FE/BE/RAG, read-only roots, bounded tmpfs, healthchecks and grace periods | Release image user/size policy and Critical CVE scan |
| Compose | Edge/app/data networks, database isolated from edge, only proxy publishes ports, safe named volumes | `compose-policy` CI job and production bootstrap |
| CI | Clean lock installs, generated OpenAPI drift, unit/integration/quality and security gates | Required repository workflows |
| Immutable delivery | SHA build produces digest; production uses the exact digest | Deploy summaries and `.deploy-history` on VPS |
| Rollback | Failed readiness smoke restores previous digest | FE/BE/RAG deploy workflow branches |
| Supply chain | Secret scan, source/container scan, source SBOM, OCI SBOM and provenance | Retained workflow artifacts and GHCR attestations |

Security waivers follow `SECURITY-WAIVERS.md`: exact finding, exploitability,
compensating control, named owner, two-party review and a maximum 30-day expiry.

## Local gate results

- Backend: `npm run verify`; 85 Jest suites / 515 tests passed.
- Frontend: lint/typecheck/contract/network checks passed; generated OpenAPI is synced.
- Frontend: 31 Vitest files / 139 tests passed; the added durable-import polling
  test also passed independently after the full run.
- RAG: compile check and 22 pytest tests passed.
- All modified workflow and Compose YAML documents parse successfully.

## Production evidence to close PASS

The coordinated main pushes must finish all three CI/deploy chains. The final edit
to this ledger records run URLs, source SHAs, deployed digests, Compose health,
graceful shutdown smoke and rollback-path evidence. Until then M4 is not marked
production PASS.
