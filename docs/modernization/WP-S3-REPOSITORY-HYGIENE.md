# WP-S3 Frontend Repository Hygiene

- Date: 2026-08-28
- Baseline commit: `35c5d70`
- Result: **PASS**
- Product behavior changes: none

## Tracked artifact audit

Two tracked files were proven to be runtime/scratch output and removed:

- `.devserver.log` (379 bytes): output from `next dev`, already identified by WP-0A as a WP-S3 cleanup candidate; no source, script or CI reference exists.
- `test.txt` (93 bytes): an otherwise unreferenced scratch file containing a browser-public access token. The value is not repeated in this evidence and no matching token remains in the current tracked tree.

The token remains in Git history. It is a public browser token rather than a server secret, but its provider-side URL/scope restrictions and rotation should be reviewed by the credential owner. WP-S3 does not rewrite shared Git history or rotate an external credential without separate authorization.

`.gitignore` now covers generic logs, temporary/backup files, `.npmrc`, and the known root scratch filename in addition to the existing environment, build, backup and restore exclusions.

## Dependency audit

Every direct runtime dependency was compared against imports, configuration, package scripts and build behavior. No dependency was removed.

`@aws-sdk/client-s3` initially appeared unused in application source. A trial removal passed lint, typecheck and 115 tests, but the production build failed because `exceljs -> unzipper` dynamically requires the S3 client. The dependency and original lockfile were restored, `npm ls @aws-sdk/client-s3 --depth=0` resolves version `3.1009.0`, and the production build then passed. This is explicit evidence that the package is runtime/build-required despite having no direct source import.

Type packages are compiler-loaded, React DOM is framework-required, and the test/lint/build packages are referenced by their respective scripts or configuration. They were retained.

## Docker context evidence

Docker is unavailable locally. The same uncompressed tar command and `.dockerignore` were used before and after as a repeatable context approximation:

```bash
tar -cf - --exclude-from=.dockerignore . | wc -c
tar -cf - --exclude-from=.dockerignore . | tar -tf - | wc -l
```

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Approximate context bytes | 19,230,720 | 19,179,520 | -51,200 (-0.27%) |
| Archive entries | 786 | 766 | -20 (-2.54%) |

The hardened `.dockerignore` excludes GitHub/hook metadata, modernization documents, runtime logs, temporary files, backup/restore output and Compose/deployment-only files. Application source and public assets remain included.

## Verification

- Fresh `npm ci`: PASS, 981 packages installed from the committed lockfile.
- `npm run check`: PASS; lint has 32 pre-existing warnings and zero errors, and typecheck passes.
- `npm test`: PASS, 23 files and 115 tests; one existing test is skipped.
- `npm run build`: PASS; Turbopack compile, TypeScript and 62-page static generation completed.
- `git diff --check`: PASS.
- Current tracked token-pattern search: no match.

The dependency audit reported three pre-existing moderate npm advisories. WP-S3 did not run an unbounded `npm audit fix`; dependency remediation remains governed by the existing audit/Dependabot process.

## Rollback

Revert the WP-S3 commit. This restores the two non-source artifacts and previous ignore rules. No database, API contract, carbon result or production state requires rollback.
