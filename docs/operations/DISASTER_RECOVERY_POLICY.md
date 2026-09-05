# Disaster Recovery Policy

- Owner: platform operations
- Review cadence: quarterly and after every material state/topology change
- Recovery point objective (RPO): 24 hours
- Recovery time objective (RTO): 60 minutes
- Required drill: before a high-risk release and at least quarterly in isolated staging

## Durable-state inventory

| State | Authority | Backup/recovery treatment |
| --- | --- | --- |
| PostgreSQL | Primary | Consistent custom-format dump, catalog validation, checksums, exact table counts and representative smoke |
| Evidence/report uploads | Primary for local file storage | Quiesced archive, path traversal rejection, inventory comparison and restored application reads |
| RAG source metadata | PostgreSQL/evidence originals | Restored with PostgreSQL/uploads and exercised through backend/RAG readiness |
| Chroma vector index | Secondary but required for legacy gaps | Quiesced archive and isolated writable restore; reindex only when all source originals are durable |
| Deployment topology | Git + immutable OCI images | Compose checksum, exact image references and source SHA in every bundle; secrets are recovered separately |
| Secrets | Approved GitHub environment/VPS secret store | Excluded from data bundles and logs; access requires platform operator role |
| Caches, build cache, ephemeral containers | Rebuildable | Not backed up |

## Protection, retention and access

Backup bundles contain customer data and must be encrypted in transit and at rest in an access-logged, versioned store. The baseline retention is 35 daily recovery points and 12 monthly recovery points; legal/customer requirements may extend but not silently shorten it. Only the platform-operator role may create/read bundles, and an incident commander must authorize disaster cutover. Restore evidence must contain hashes, counts and timings—not customer content or secrets.

The local `backups/` directory is a short-lived staging area, not the retained backup system. A backup is operationally complete only after encrypted off-host upload, checksum verification at the destination and retention-policy confirmation. Key loss, unauthorized access, missing originals or an over-budget drill is a release blocker and incident.
