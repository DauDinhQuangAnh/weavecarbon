# WP-S1 Backup and Restore Runbook

- Date: 2026-09-05
- Scope: PostgreSQL, durable customer files in `be_uploads`, and the recoverable RAG index in `rag_data`
- Production execution in this work package: **not authorized and not performed**
- Destructive live restore: **not implemented**

WP-S1 is the safety gate that must pass before a migration can affect calculation history, tenancy, evidence metadata, or indexes. A successful dump alone is not a pass: its checksums, isolated database restore, exact table counts, representative records, and file archives must all be verified.

## Data ownership covered by the bundle

- PostgreSQL is authoritative for tenants, products, calculation history, evidence metadata, audit records, reports, and migration checksums.
- `weavecarbon_be_uploads` is authoritative for locally stored evidence originals, compliance documents, report exports, and B2C images.
- `weavecarbon_rag_data` contains the Chroma index. It is secondary data, but is included because older evidence uploads may not have a durable original file from which the index can be rebuilt.
- `rag_cache`, Caddy state, container images, source code, and secrets are not included. Source and images come from Git/GHCR; secrets must come from the approved secret store.

New evidence uploads are persisted atomically under `uploads/evidence/<company>/<year>/` before their database record is created. Existing rows whose `storage_provider` is `memory` cannot be backfilled automatically because the original bytes were never retained. Treat those rows as a known historical recovery limitation until a separate evidence audit is completed.

## Create a development or staging backup

Prerequisites:

- Run from the frontend/deployment repository on the Docker host.
- `.env.vps` must be present and `docker compose config` must succeed.
- PostgreSQL must be running, and named volumes `weavecarbon_be_uploads` and `weavecarbon_rag_data` must exist.
- Reserve enough free disk for a database dump plus both compressed volume copies and an isolated restore.
- Announce a maintenance window. The script briefly stops backend and RAG services to prevent writes, then resumes only services that were running when it started.

Create the bundle:

```bash
./deploy/backup-state-vps.sh
```

`./deploy/backup-db-vps.sh` remains as a compatibility wrapper and now invokes the same complete state backup. The reset script therefore also creates a full bundle unless the operator explicitly supplies its existing dangerous `--skip-backup` option.

The final directory is `backups/state-<UTC timestamp>/`. It appears only after all source checks succeed. Files are created with a restrictive umask and include:

- `database.dump`: PostgreSQL custom-format dump without ownership or grants;
- `database-catalog.txt`: output proven readable by `pg_restore --list`;
- `database-counts.tsv`: exact row count for every non-system table;
- `uploads.tar.gz` and `uploads-members.txt`;
- `rag-data.tar.gz` and `rag-data-members.txt`;
- `deployment-manifest.env` with exact database/backend/RAG/frontend/proxy image references, Compose checksum and frontend source SHA, but no secrets;
- `metadata.env` with non-secret backup facts;
- `SHA256SUMS` covering every component.

The bundle can contain customer data. Never commit it, attach it to a ticket, or copy it unencrypted. `backups/` is Git-ignored, but that is not an encryption control. Use the organization's encrypted backup destination and access policy for any off-host copy.

## Prove the restore in isolation

Run against development or staging first:

```bash
./deploy/restore-state-drill-vps.sh --bundle ./backups/state-YYYYMMDDTHHMMSSZ
```

An optional target can be supplied:

```bash
./deploy/restore-state-drill-vps.sh \
  --bundle ./backups/state-YYYYMMDDTHHMMSSZ \
  --target-db weavecarbon_restore_20260827
```

The restore script has these hard stops:

- it creates a uniquely named Docker network and a disposable PostgreSQL 16 container;
- it never connects the restored applications to the configured live database or live volumes;
- it rejects an existing restore directory;
- it verifies every SHA-256 entry and both archive formats before restore;
- it rejects absolute or parent-traversal archive paths;
- it restores files only below `restore-drills/<target>/`, never into a live volume.

A pass requires an empty database created from `template0`, a successful `pg_restore --exit-on-error`, an exact match of all table counts, matching upload/RAG archive inventories, and successful startup of the exact backend, RAG and frontend images currently deployed. The critical smoke creates only an isolated demo session and verifies auth, dashboard, product, evidence, RAG readiness and frontend health paths. The report is written to `restore-drills/<target>/restore-report.txt`.

The default recovery objectives are RPO <= 24 hours and RTO <= 60 minutes. Override them only with approved positive integer seconds:

```bash
RPO_TARGET_SECONDS=86400 RTO_TARGET_SECONDS=3600 \
  ./deploy/restore-state-drill-vps.sh --bundle ./backups/state-YYYYMMDDTHHMMSSZ
```

The script measures RPO from the quiesced backup recovery point and RTO from drill start through all critical smoke checks. It fails even after successful data integrity checks if either budget is exceeded. Disposable containers and their private network are always removed. The restored files and non-secret report remain for review; transient copies of container environment variables are deleted before reporting.

Inspect representative records whose IDs and expected values are approved for the environment. Do not paste personal or customer data into the runbook. The automated CI drill uses synthetic calculation-history and tenant-evidence sentinels and verifies their exact values plus representative file hashes.

## Failure handling

If backup fails:

- the trap resumes backend/RAG services that the script stopped;
- the guarded `.partial-state-*` directory is removed;
- no final backup directory is published;
- stop the planned migration and investigate disk capacity, service state, volume availability, and command output.

If restore verification fails:

- do not run the migration;
- preserve `restore-drills/<target>/` for diagnosis; the disposable database container is removed automatically;
- create a new backup after correcting the cause and repeat the entire drill;
- delete only the explicitly named restore directory after the evidence has been reviewed.

This procedure intentionally does not overwrite a live database or live volume. A real disaster recovery cutover requires separate incident authorization, a verified bundle, a fresh target, application maintenance mode, and an explicit cutover/rollback plan.

## Gate decision

WP-S1 is **PASS** only when all of the following are true for the commit being migrated:

1. Backend syntax, lint, and unit tests pass.
2. Backend CI loads the actual schema and migrations into PostgreSQL 16.
3. `scripts/backup-restore-drill.sh` passes its isolated synthetic database and evidence restore.
4. The CI artifact `wp-s1-backup-restore-<run id>` contains a `status=PASS` report.
5. For a real staging migration, the operator also runs the VPS drill above and reviews representative staging records.

Until these conditions pass, schema/data migration work remains blocked.
