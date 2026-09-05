# M4 — Operations, Containers and CI/CD Platform

Status: PRODUCTION PASS (2026-09-05).

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

- Backend: `npm run verify`; the final Backend CI suite passed, including the
  durable PostgreSQL drill and runtime-container policy.
- Frontend: lint/typecheck/contract/network checks passed; generated OpenAPI is synced.
- Frontend: 31 Vitest files / 139 tests passed; the added durable-import polling
  test also passed independently after the full run.
- RAG: compile check and 24 pytest tests passed. Container CI also exercised
  `/ready` against a writable Chroma store.
- All modified workflow and Compose YAML documents parse successfully.

## Production evidence

| Component | Source | CI / deploy evidence | Result |
| --- | --- | --- | --- |
| Frontend/platform | `0d81b415c709fabbfc73d8a2056252513f8c5bb4` | [CI 33939781219](https://github.com/DauDinhQuangAnh/weavecarbon/actions/runs/33939781219), [deploy 33939842778](https://github.com/DauDinhQuangAnh/weavecarbon/actions/runs/33939842778) | PASS |
| Backend | `3159ce92dce228026015bb4738e3ae45e74695dc` | [CI 33937734119](https://github.com/DauDinhQuangAnh/BE_weavecarbon/actions/runs/33937734119), [deploy 33937764976](https://github.com/DauDinhQuangAnh/BE_weavecarbon/actions/runs/33937764976) | PASS |
| RAG | `6c3302111cfde1ba731f52bbbedae17510cc725a` | [CI/publish/deploy 33939792465](https://github.com/DauDinhQuangAnh/API_RAG/actions/runs/33939792465) | PASS |

- RAG immutable image deployed at
  `ghcr.io/daudinhquanganh/api_rag@sha256:c5c97084291788ce8d43f9fd8befc64af2db706ccb3b9d583bc7a166fbc95e34`.
  FE/BE packages are private; their exact deployed digests are retained in each
  successful workflow summary, OCI attestation, and the VPS `.deploy-history`.
- The deployment repaired ownership and write mode on the existing RAG volume,
  validated it with an unprivileged write probe, and preserved all Chroma data.
- The final RAG container passed `/ready` against the production Chroma volume.
  FE and BE smoke checks returned HTTP 200 through the production proxy; backend
  responses included a generated `X-Correlation-ID`.
- Failed RAG readiness attempts exercised automatic immutable-image rollback.
  A proxy/upstream 502 during the first Compose migration exposed and fixed the
  partial-rollout policy: partial deploys no longer delete sibling services and
  Caddy is recreated after a healthy upstream rollout.
