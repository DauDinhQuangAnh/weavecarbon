# WeaveCarbon Operations Runbooks

These procedures assume the Compose owner directory, `.env.vps`, least-privilege Docker/SSH access and an incident log. Never paste secrets or customer records into the log. Stop and escalate if a command would target an unidentified database, volume or host.

## Deploy and rollback

1. Confirm exact-head CI is green for frontend, backend and RAG and record all three SHAs/image digests.
2. Create a current state backup before a schema/data change. Run the full isolated restore drill for a high-risk release.
3. Deploy one repository through its GitHub Actions workflow. Do not edit an image tag manually during an active workflow.
4. Require service readiness, public `/health`, correlation ID and critical authenticated smoke.
5. On failure, let the workflow restore the previous digest. Confirm readiness and record both digests; do not retry repeatedly without diagnosing logs/metrics.

## Migration failure

1. Keep the failing application version out of service and preserve migration logs and the exact schema version.
2. Determine whether the migration committed. Do not rerun an uncertain non-idempotent statement.
3. For additive migrations, correct forward in a new reviewed migration. For data corruption or destructive partial state, declare an incident and restore to a new isolated target before any cutover.
4. Re-run migration snapshot, tenant/factor integrity and hot-query plan checks before deployment resumes.

## RAG outage

1. Check `/ready`, container state, memory/disk, queue timeouts and backend proxy errors. Keep the internal key private.
2. If the vector client is poisoned after an interrupted start, restart RAG once; readiness clears the cached failed client for the next probe.
3. If the index is corrupt, preserve it, restore the latest verified `rag_data` bundle or reindex only from durable evidence originals. Never delete the live volume as a first response.
4. Keep non-RAG product/carbon workflows available and communicate degraded AI behavior.

## Queue backlog

1. Capture `/metrics`, `operational_jobs` counts and oldest queued/running timestamps.
2. Identify whether workers, database saturation, a single job kind or an external dependency is limiting throughput.
3. Scale or restart workers only after checking leases/idempotency. Never delete queued/dead jobs to make a graph green.
4. Replay a dead job only after correcting its cause; retain the original failure evidence.

## Database saturation

1. Capture `pg_stat_activity`, `pg_stat_database`, pool symptoms, slow-request logs, CPU, memory and disk.
2. Stop load tests and nonessential batch ingestion. Preserve interactive carbon/evidence traffic.
3. Find the measured query/lock/index bottleneck; cancel a query only with incident authority and a recorded PID/tenant impact.
4. Validate the fix with the hot-query audit and staging baseline before production rollout.

## Disaster recovery

1. Classify the incident and freeze writes. Select a verified encrypted bundle whose recovery point satisfies the approved RPO.
2. Run `deploy/restore-state-drill-vps.sh` against that bundle. It restores PostgreSQL/uploads/RAG and starts all application tiers in disposable isolation.
3. Review exact table counts, archive inventories, critical smoke and measured RPO/RTO in `restore-report.txt`.
4. A real cutover is a separate authorized action: allocate fresh durable volumes/database, restore, validate, switch traffic, retain the old environment for rollback and monitor.
5. Never point the drill at live volumes or overwrite the old environment in place.
