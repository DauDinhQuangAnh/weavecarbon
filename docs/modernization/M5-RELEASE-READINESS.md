# M5 — Release Readiness

- Date implemented: 2026-09-05
- Work packages: WP-PR1, WP-PR2, WP-PR3
- Code status: **PASS**
- Modernization delivery status: **COMPLETE**
- Environment evidence status: **DEFERRED BY PRODUCT OWNER**
- Release certification: **NOT READY**

M5 consolidates the final three playbook work packages into one release gate. It adds repeatable load profiles and enforced budgets, a full isolated state recovery drill with measured RPO/RTO, accepted architecture decisions, incident runbooks and an evidence validator that cannot issue PASS from incomplete artifacts.

## Implemented controls

- Two-layer target validation blocks accidental production load and rejects non-HTTPS remote targets.
- Read, write/report, RAG query and RAG ingest workloads are separated so costly or mutating traffic is explicit and bounded.
- Operational snapshots cover application metrics, queue depth, PostgreSQL activity and container resources before/after load.
- Backup metadata records the quiesced recovery point and duration.
- Restore uses disposable database/backend/RAG/frontend containers and a private network; it verifies checksums, archive paths, exact table counts, critical flows and RPO/RTO without writing to live state.
- The release workflow verifies successful CI for the exact `main` head of all three repositories, then requires staging smoke, every performance profile, operational snapshots and a full DR PASS.
- `scripts/check-release-evidence.mjs` rejects missing, unsafe or over-budget evidence and generates the final decision artifact.

## External gate still required

Repository code alone cannot honestly certify capacity or recovery time. Configure the GitHub `staging` environment with `STAGING_BASE_URL`, `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`, `STAGING_APP_DIR`, `STAGING_B2B_ACCESS_TOKEN`, `STAGING_ADMIN_ACCESS_TOKEN` and `STAGING_RAG_COLLECTION`, then run `M5 Release Readiness` in `full` mode. The B2B token exercises tenant workflows while the platform-admin token is limited to the separate RAG profiles. Only the generated `RELEASE_READINESS.md` artifact may mark the product release-ready.

Until that full staging run succeeds, the checked-in release decision remains NOT READY even though the M5 implementation itself is complete.

## Deferred closeout

On 2026-09-05, the product owner chose to defer provisioning an isolated staging environment. This closes the planned modernization implementation without claiming that capacity, performance, RPO, or RTO have been certified.

The `deferred` workflow mode verifies successful CI for the exact current head of all three repositories and produces a `NOT READY` decision artifact. It cannot execute staging traffic and cannot produce `PASS`. The existing `full` mode and every staging safety check remain unchanged.

Run the full staging gate before commercial launch, a material traffic increase, a high-risk database or storage migration, or any release that requires formal capacity or recovery evidence.
