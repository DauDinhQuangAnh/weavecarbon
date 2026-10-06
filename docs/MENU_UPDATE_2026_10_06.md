# Menu update — 6 October 2026

## User scope

The user clarified: leave the nine old menus alone; only update or add the remaining menus. This increment implements the navigation and its new pages. It does **not** establish complete implementation of every requirement in the 12 September Word document.

Protected paths: `/overview`, `/products`, `/logistics`, `/carbon-calculator`, `/evidence`, `/export`, `/reports`, `/audit-trail`, `/billing`. Their descriptors, labels, icons, relative order, trial visibility, APIs and page files are preserved. They remain outside the new collapsible groups. The existing settings visibility and demo route prefixes remain intact. Existing local changes predating this increment are retained.

Navigation reference: `C:/Users/20521/Downloads/weavecarbon/src/components/dashboard/DashboardSidebar.tsx`. Six groups adapted to the existing application: Carbon, Dữ liệu, Chuỗi cung ứng, Phân tích, Sẵn sàng, Dữ liệu kết nối. Existing unprotected modules remain available inside those groups. The old `/data-governance`, `/vn-mrv`, `/weavenode` URLs still work alongside their new aliases. Lovable code, Supabase configuration and synthetic metrics were not imported.

Requirements reference: `C:/Users/20521/Downloads/WeaveCarbon Mới cập nhật 12.09.docx`, SHA-256 `fe2a4e4bf94c01d0fb5d06ac4f9711fbe1d9481e571260985c59e4d2c208b5d4` (same content as workspace copy). This increment follows the document's activity collection, canonical facility/process identity, evidence provenance, quality, revision and readiness workflow. The document-to-source gap audit remains `WEAVECARBON_12_09_SOURCE_RECHECK_2026-10-06.md` in the parent workspace.

## New entry points

Every entry below has both a real route and a `/demo` route (24 new routes total).

| Route | Function and actual data boundary |
| --- | --- |
| `/emissions` | Reads corporate GHG inventory snapshots; selects the latest revision per reference; shows Scope 1, separate Scope 2 accounting views and Scope 3; exports actual values and result hash to CSV. No cross-period or cross-inventory aggregation. |
| `/hotspots` | Groups persisted, finite, nonnegative `calculatedCo2eKg` lines by facility or category within one inventory. Uses location-based Scope 2; excludes the alternative market-based view. Displays excluded source count; no recomputation from raw quantities. |
| `/facilities` | Searches/list revisions; creates a facility revision with reference, timezone and boundary through the industrial API. |
| `/processes` | Filters by facility revision; creates a process revision bound to that facility. |
| `/activity-data` | Reuses the existing provenance-hashed activity collection and review panel with the existing APIs. Shows up to 500 recent activities; quantities are not represented as CO2e. |
| `/evidence-graph` | Traces a selected activity to stored facility/process/measurement point/evidence/latest review relationships. Missing relationships are explicit. Calculation/allocation are linked separately; this is not a complete enterprise graph. |
| `/verification` | Named internal activity review with reasons. Approval requires controlled evidence with valid SHA-256; the backend additionally verifies current evidence and tenant scope. Internal review is not independent assurance. |
| `/inbox` | Searchable derived tasks from recent L1/L2 activity sources, uncontrolled evidence and pending factor governance. Links to actual workflows; no fake completion button. Not a comprehensive compliance task registry. |
| `/compliance` | Inspect actual capability registry and entity coverage against three preparation paths. Shows partial/planned status and next gates. Does not assert legal filing or certification readiness. |
| `/data-quality` | Alias of the existing data governance module; implementation unchanged. |
| `/vietnam-carbon` | Alias of the existing Vietnam MRV module; implementation unchanged. |
| `/connected-data` | Alias of the existing WeaveNode module; implementation unchanged. No new hardware acceptance claim. |

Industrial mutation permission is `isRoot && canMutate && !demo`, preserving the backend company-admin and subscription policy. Demo paths use isolated, explicitly synthetic, read-only records or honest empty inventory states. Permission failures are surfaced, not replaced with fabricated data. Requests hide data immediately on tenant/selection changes and ignore out-of-order responses and retained callbacks from previous tenants. CSV strings are quoted and spreadsheet formula prefixes are neutralized.

## Freeze enforcement

- Root and frontend `AGENTS.md` record the user instruction for subsequent work.
- `docs/protected-pages.snapshot.json` captures 666 existing FE dependencies and BE source/migration files **before** navigation edits. Text hashes normalize CRLF/LF; binary hashes use raw bytes. The shared sidebar is the explicitly authorized exception, checked separately by descriptor and rendered navigation tests.
- `node scripts/check-protected-pages.mjs` checks both primary checkouts. `--frontend-only` supports standalone FE CI. Capture refuses to overwrite an existing snapshot; never update it to conceal modifications.
- Pre-push runs the freeze and navigation checks before normal verification. Frontend CI adds a freeze job and a negative regression test. This is a repository gate; it is not OS access control or remote branch protection. Hook bypass and changes to the baseline/checker require review.

## Verification

- Final full Vitest run: 84 files / 317 tests passed.
- Freeze guard: all 666 files unchanged. Its negative test detects mutation and deletion while allowing EOL differences and standalone FE checking.
- `npm run check`: passed lint (57 existing warnings, zero errors), TypeScript, OpenAPI freshness, bounded HTTP transport, load-target policy tests and release-evidence validator tests. Targeted lint of the new implementation and sidebar: zero warnings/errors.
- `npm run build`: passed, including all 24 new route entries.
- `npm run performance:check`: all eight existing route budgets passed. 234 client chunks, **14,097,160 raw JS bytes** against **14,500,000** (402,840 bytes remaining). Previous build: 13,837,236 bytes; this increment adds 259,924 bytes. No budget was raised.
- Browser attempt against the production server at `127.0.0.1:3100/demo/facilities`: existing root health gate showed maintenance. Automatic approval review rejected overriding `BACKEND_HEALTH_URL` to a local stub. No protected gate was changed or bypassed; integrated visual QA therefore remains unverified. Component interaction tests cover read-only roles/demo, failed saves, evidence approval and navigation behavior.
- No deployment, live database writes/migrations or paid AI/provider calls were performed. Local smoke servers were stopped after the check.

## Remaining document work

Versioned target requirements, document-specific DQL semantics (including independent verification), real domestic-to-export acceptance, hardware soak/calibration, licensed climate ingestion/expert review, commercial plans and full release acceptance remain separate requirements. This menu increment exposes current functions and gaps; it does not declare those gates complete. Production data workflows still require integration/acceptance testing with the deployed backend and a dedicated test tenant.
