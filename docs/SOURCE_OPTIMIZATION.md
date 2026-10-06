# Source and dependency optimization — 2026-09-22

Baseline: frontend `14e3af3`, backend `00ba467`. Measurements use Node 22.14.0,
npm 11.9.0 and a local Windows production build. These are local engineering
checks, not new production deployment or full release-readiness evidence.

## Changes implemented

- Replace the Radix umbrella dependency with the seven component packages
  actually imported by the UI, retaining their existing locked versions.
- Remove seven unused UI files: `toaster`, `toast`, `toggle-group`, `toggle`,
  `RedFlagBanner`, `MethodologyBanner` and `LazyMountOnView` (430 source lines).
  Import and reference searches found no application consumers; `toggle` was
  used only by the retired `toggle-group`. Remove the three Radix toast/toggle
  packages as well. The active Sonner notifications and `CompliancePanel` remain.
  Retire only the deleted banner's entry in the claim-safety test; all checks on
  remaining surfaces are unchanged. Removed files remain recoverable from Git.
- Use ExcelJS's published browser bundle for in-memory report workbooks. This
  prevents client-component SSR from following the Node streaming/ZIP/S3 path,
  allowing removal of the direct AWS S3 SDK dependency. Removing that SDK alone
  fails the production build; the browser runtime change is required with it.
- Load the product spreadsheet reader only after a file is selected and read.
  A narrow module entry exposes `read` and `utils` without retaining all package
  exports. XLSX, legacy XLS and CSV remain supported.
- Backend: mount Swagger through `src/config/apiDocs.js`, loading the UI and
  generating its contract only outside production. Swagger packages are now
  development dependencies; production no longer supports the legacy
  `ENABLE_API_DOCS=true` override. Local documentation and CI contract checks remain.

## Measurements

| Metric | Before | After |
| --- | ---: | ---: |
| Frontend lockfile package entries, excluding root | 1,154 | 1,031 |
| Frontend installed dependency files | 60,391 | 56,266 |
| Frontend installed dependency bytes | 873,847,883 | 863,346,722 |
| Frontend lockfile bytes | 638,893 | 548,665 |
| Total emitted client JavaScript bytes | 13,036,945 | 12,991,951 |
| Backend production install packages | 218 | 177 |
| Backend production dependency bytes | 54,255,142 | 31,791,077 |
| Backend production dependency files | 5,829 | 4,466 |

No retained package version changed. Installed sizes include development tools
and are not Docker-image or browser-transfer sizes. The total client bundle
decreased by about 0.35%; the larger loading improvement is deferring the
spreadsheet reader until use. The resulting reader chunk is 364,728 raw bytes.
All eight existing route bundle budgets pass.

The component-only cleanup leaves emitted client JavaScript unchanged at
12,991,951 bytes: these files were not in the active module graph. Its benefit
is reducing source and installed dependencies, not a claimed browser speedup.

In a local import probe after API routes were loaded, Swagger added 190 modules.
The production-disabled documentation path now loads only the small mounting
helper and no Swagger modules. This is not a measurement of whole-server RSS.

The backend production measurements compare fresh `npm ci --omit=dev`
installations before and after moving Swagger to development dependencies.
No retained package versions changed. The reduction is 22,464,065 bytes
(21.42 MiB) before container compression. The three Swagger packages are absent
from the resulting install. A local HTTP smoke check with application bootstrap
stubbed (no database access) returned `/health` 200 and `/api-docs` 404 even with
the legacy flag set; dependency resolution was restricted to the isolated install.

## Verification

- Backend: syntax, lint, OpenAPI contract/staleness and module boundaries pass;
  176 Jest suites / 956 tests pass, including documentation loading controls.
- Frontend: lint has zero errors; warnings remain in unchanged files. Typecheck,
  API contract, network boundaries and existing policy/evidence checks pass.
- Frontend: the full Vitest suite passes, including spreadsheet parsing and
  report workbook structure, values, formatting and serialization checks.
- Production build and client bundle budget checks pass. After component cleanup,
  the complete check/test/build sequence and bundle budgets were rerun.
- No database migration, real-data pilot, host inspection or deployment was
  performed for this optimization.

## Remaining measured hotspots

Tracked source is about 5.5 MiB in the backend and 19.5 MiB in the frontend;
13 MiB of the latter is public assets. Large local dependency/build directories
should not be confused with tracked application source.

1. Backend `src/services/exportShipmentService.js` is approximately 281 KB and
   combines many dossier workflows. Extract cohesive workflows one at a time,
   preserving tenant checks, transactions, snapshots and existing tests.
2. Frontend ships both Mapbox and MapLibre. Consolidation needs map, geocoding,
   route and sovereignty-label verification before either library can be removed.
3. The landing animation preloads 200 image frames plus a 3D model. Profile
   decoded-image/GPU memory and network loading before changing its presentation.
4. Large assessment, donation and product API modules merit separate focused
   refactors. File splitting alone does not establish a runtime size reduction.

Keep report evidence, migrations, contracts and acceptance runbooks: their size
is modest and they protect the report and release boundaries.
