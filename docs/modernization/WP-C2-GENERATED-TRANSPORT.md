# WP-C2 — Generated Frontend Transport Types

Status: PASS

## Outcome

The frontend now generates transport types from the backend OpenAPI artifact into the isolated `lib/api/generated/` directory. Generated files contain types only and must not contain business logic.

The hand-written `lib/api/openapiClient.ts` binds those generated path, parameter, body, and success-response types to the existing `apiRequest` transport. This deliberately preserves the established authentication refresh, cache, authorization guard, and demo-adapter behavior.

`lib/api/companyMembers.ts` is the first domain adapter. It converts the generated `CompanyMember` snake_case transport into a camelCase UI model. The audit-trail page now uses this adapter, removing its duplicate hand-maintained transport interface. The larger users-settings migration remains incremental follow-up work.

## Reproducible workflow

1. In the backend repository, run `npm run openapi:export`.
2. In the frontend repository, run `npm run contract:sync`.
3. Commit `contracts/backend.openapi.json` and `lib/api/generated/backend.ts` together.
4. Run `npm run contract:check:backend` when both repositories are available.

`npm run contract:generate` regenerates types from the committed snapshot without requiring the backend checkout. `npm run contract:check` performs a byte-for-byte staleness check. Frontend CI also checks the committed snapshot against the backend `main` artifact before lint/typecheck.

## Boundaries and remaining risk

- Only Company Members is migrated in this bounded package. Other active calls continue using their existing DTOs until migrated feature by feature.
- Generic OpenAPI response schemas remain intentionally broad where WP-C1 could not prove a domain-specific payload. Those calls should not be migrated until their schemas are specialized.
- The generated client models the successful JSON envelope and then reflects the existing `apiRequest` behavior, which unwraps `data` before returning to callers.

## Verification evidence

- Generated artifact: 215,690 bytes, derived from the 257,389-byte, 130-path/166-operation snapshot.
- Reproducibility: `contract:check` and `contract:check:backend` passed byte-for-byte.
- Contract coverage audit: 377 source files, 126 static operations, 4 reviewed dynamic helpers, 0 missing operations.
- Manual company-member read transport DTOs: 2 before, 1 after; audit-trail now consumes the generated schema through the adapter.
- `npm run verify:full`: 25 test files passed, 118 tests passed, 1 existing test skipped; typecheck passed; lint had 0 errors and 21 pre-existing React compiler warnings.
- `npm run build`: passed for all 62 application routes.

## Rollback

Revert the WP-C2 frontend commit. The audit-trail page can return to its local `CompanyMember` DTO and direct `apiRequest` call; no backend endpoint or stored data changes are involved.
