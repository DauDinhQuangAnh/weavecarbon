# WP-C1 Frontend Contract Audit

- Date: 2026-08-28
- Baseline commit: `a84c88e`
- Result: **PASS**
- Product behavior changes: one broken audit-trail member lookup was corrected to the existing backend contract

## Audit result

`npm run contract:audit` uses the TypeScript compiler AST to inspect active API calls under `app`, `components`, `contexts`, `hooks` and `lib`, then compares them with the sibling backend OpenAPI module.

Evidence from the final tree:

- 374 TypeScript/TSX source files scanned.
- 126 statically resolved frontend operations.
- 3 variable-path helper dispatches reviewed against their current primary routes.
- 0 current operations missing from OpenAPI.

Use `BACKEND_REPO_PATH` to point the command at a non-sibling backend checkout.

## Corrected mismatch

`app/(dashboard)/audit-trail/page.tsx` requested `/company-members`, which is not mounted by the backend. It now requests `/company/members` and consumes the actual `user_id` and `full_name` fields. The response remains unwrapped by the shared API client before reaching the page.

No backend compatibility alias was added and no public API behavior changed.

## Recorded legacy fallbacks

The auth and logistics helpers still contain secondary fallback candidates for `/auth/sign-out`, `/shipments` and `/shipments/{id}`. The current backend does not mount these paths; their primary `/auth/signout` and `/logistics/shipments...` operations are documented and tested. WP-C1 records the legacy values without inventing them in OpenAPI.

## Verification

- `npm run contract:audit`: PASS.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with the 21 previously recorded React compiler/hook warnings and zero errors; no new warning was introduced.
- `npm test`: PASS, 23 files and 115 tests; one existing test is skipped.
- `npm run build`: PASS; TypeScript and 62-page static generation completed.

## Rollback

Revert the WP-C1 frontend commit. The audit-trail member-name lookup will return to the nonexistent route, while the contract audit command and evidence document will be removed. No persisted state needs rollback.
