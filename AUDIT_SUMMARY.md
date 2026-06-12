 # Audit Summary

 ## Executive Summary

 The audit mapped 107 distinct frontend UI functions across navigation, client-only interactions, server/API actions, and expected-but-not-visible page functions. Runtime validation passed for frontend lint/typecheck/build/check and an existing frontend dev-route probe on `/` and `/export`. Backend syntax and migration passed; `/health` responded on the already-running backend at port 4100.

 No UI action is marked `WORKING` from static inspection alone. Most actions remain `NEEDS_MANUAL_TEST` because they require authenticated sessions, seeded data, browser interaction, file uploads, payment/OAuth/email providers, Mapbox, or RAG services. Demo/local-storage flows are marked `MOCK`.

 ## Totals

 Total UI actions audited: 107

 | Status | Count |
 | ------ | ----- |
 | WORKING | 0 |
 | PARTIAL | 8 |
 | MOCK | 6 |
 | BROKEN | 0 |
 | MISSING_BACKEND | 2 |
 | NEEDS_MANUAL_TEST | 88 |
 | NOT_AVAILABLE_ON_UI | 3 |

## Phase Export — Xuất khẩu Page

Export route files found:

- `app/(dashboard)/export/page.tsx`
- `app/demo/export/page.tsx`
- `components/dashboard/export/ExportClient.tsx`
- `components/dashboard/export/ComplianceDetailModal.tsx`
- `components/dashboard/export/ComplianceRecommendations.tsx`
- `components/dashboard/export/ComplianceProductScope.tsx`
- `components/dashboard/export/ComplianceCarbonData.tsx`
- `components/dashboard/export/ComplianceDocuments.tsx`
- `components/dashboard/export/ExportConfigurationPortalV2.tsx`
- `components/dashboard/export/CompanyDataExportCardV2.tsx`
- `components/dashboard/export/readiness.ts`
- `components/dashboard/export/types.ts`
- `lib/exportComplianceApi.ts`
- `lib/weave-v2/exportV2Api.ts`
- `lib/weave-v2/evidenceV2Api.ts`
- `lib/reportsApi.ts`

Export function inventory now covers `EXP-001` through `EXP-027` in `UI_FUNCTION_AUDIT.md`. No Export function is marked `WORKING` because authenticated browser/manual click-through was not completed. `EXP-021` DPP lock, `EXP-024` buyer webhook payload, and `EXP-019` config save are `PARTIAL` because they have controlled local/demo fallback behavior. `EXP-025` audit pack download is `MOCK` for new-account/demo data. `EXP-016`, `EXP-026`, and `EXP-027` are `NOT_AVAILABLE_ON_UI` because recommendation actions, export dossier creation, and public passport linking are not visible on the current Export page.

Export API calls confirmed by static contract check:

- `GET /api/export/markets`
- `POST /api/export/markets/:market_code/recommendations/:recommendation_id/actions`
- `POST /api/export/markets/:market_code/products`
- `PATCH /api/export/markets/:market_code/products/:product_id`
- `DELETE /api/export/markets/:market_code/products/:product_id`
- `PATCH /api/export/markets/:market_code/carbon-data/:scope`
- `POST /api/export/markets/:market_code/documents/:document_id/upload`
- `GET /api/export/markets/:market_code/documents/:document_id/download`
- `POST /api/export/markets/:market_code/documents/:document_id/approve`
- `DELETE /api/export/markets/:market_code/documents/:document_id`
- `POST /api/export/markets/:market_code/reports`
- `GET /api/export/configuration`
- `PUT /api/export/configuration`
- `POST /api/export/dpp-locks`
- `GET /api/export/documents/commercial-invoice`
- `GET /api/export/documents/packing-list`
- `GET /api/export/documents/bill-of-lading`
- `POST /api/export/buyer-webhook-payload`
- Related only because the Export page calls them: `GET /api/products`, `GET /api/evidence/product/:id`, `GET /api/reports/export-data/:type`, fallback `POST /api/reports`.

Recommended next fix phase: Phase Export-2 should start with manual new-account Export page verification, then improve remote-vs-local fallback visibility for DPP lock and buyer webhook payload, then add download error toasts for the three commercial document buttons if manual testing confirms silent failures.

Phase Export-2.0 hotfix applied after manual screenshot evidence: product-scope add now passes `operation: productForm.mode` from `ComplianceDetailModal.tsx` to `upsertComplianceProduct` in `lib/exportComplianceApi.ts`, so add mode uses `POST /api/export/markets/:market/products` and edit mode uses `PATCH /api/export/markets/:market/products/:productId`. Retest `EXP-011` before marking it working.

 ## Top 10 Bugs

 | Rank | Bug ID | Severity | Summary | First Fix Area |
 | ---- | ------ | -------- | ------- | -------------- |
 | 1 | BUG-003 | High | B2C coupon redeem CTA has no discovered backend/API implementation. | B2C coupons |
 | 2 | BUG-004 | High | Evidence backend/wrappers exist, but visible create/lock UI was not found. | Evidence/export UI |
 | 3 | BUG-005 | High | Subscription/payment endpoints use non-baseline response shapes. | Subscription API contract |
 | 4 | BUG-006 | High | DPP lock falls back to local payload when remote lock fails; confirmed again in Phase Export inventory as EXP-021. | Export V2 DPP |
 | 5 | BUG-007 | Medium | Buyer webhook payload falls back to local JSON when backend fails; confirmed again in Phase Export inventory as EXP-024. | Export V2 webhook |
 | 6 | BUG-008 | Medium | Product bulk file import is not verified. | Products bulk import |
 | 7 | BUG-009 | Medium | Batch publish has broad shipment/compliance side effects and is unverified. | Product batches |
 | 8 | BUG-010 | Medium | B2C donation multipart image submit is unverified. | B2C donation |
 | 9 | BUG-002 | High | Fixed - pending manual verification. Backend now verifies `current_password`; FE uses only `POST /api/account/change-password`. | Settings manual verification |
 | 10 | BUG-001 | Medium / Dev Environment | PowerShell blocks `npm.ps1`; `npm.cmd` works. This is not an application runtime bug. | Development environment documentation |

 ## Phase 2 Fixing Order

 1. Phase 2.1: startup, build, auth, global runtime errors.
 2. Phase 2.2: account/company, dashboard, products.
 3. Phase 2.3: batches, logistics, carbon data flow.
 4. Phase 2.4: reports, export, passport/DPP/QR.
 5. Phase 2.5: evidence, subscription/payment, AI/chat/config, B2C.
 6. Phase 2.6: UI polish and cleanup.

 ## Exact Files Likely Edited In Phase 2

 - `components/dashboard/settings/PersonalSettings.tsx`
 - `components/dashboard/settings/SystemSettings.tsx`
 - `components/b2c/B2CCouponsClient.tsx`
 - `lib/b2cApi.ts`
 - `D:\hoctap\BE_weavecarbon\src\routes\b2c.js`
 - `D:\hoctap\BE_weavecarbon\src\services\b2cService.js`
 - `components/dashboard/export/ExportConfigurationPortalV2.tsx`
 - `components/dashboard/export/ExportClient.tsx`
 - `lib/weave-v2/evidenceV2Api.ts`
 - `D:\hoctap\BE_weavecarbon\src\routes\evidence.js`
 - `D:\hoctap\BE_weavecarbon\src\routes\subscription.js`
 - `components/dashboard/PricingModalGate.tsx`
 - `components/dashboard/products/BulkUploadModal.tsx`
 - `components/dashboard/products/BatchManagementModal.tsx`
 - `components/b2c/B2CDonationClient.tsx`

 ## First Safe Code Change Recommendation

Completed first safe code change: `POST /api/account/change-password` now verifies `current_password`, handles password-login-unavailable accounts explicitly, and both settings forms use the single correct API endpoint with `current_password`, `new_password`, and `confirm_password`. The remaining action is manual verification of mismatch, wrong-current, correct-current, and old/new login behavior.

 ## Runtime Notes

 - Frontend `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run check` passed on June 12, 2026.
 - Existing frontend dev server responded HTTP 200 on `/` and `/export` at port 3000; a duplicate dev process was not started.
 - Backend `npm.cmd run check:syntax` and `npm.cmd run migrate` passed on June 12, 2026.
 - Backend duplicate `npm.cmd run dev` start hit `EADDRINUSE` on port 4100 because an existing backend server was already running; the newly started crashed wrapper was stopped, and the existing `/health` responded HTTP 200.
 - `npm run ...` is blocked by PowerShell execution policy in this shell; `npm.cmd run ...` works.
 - Backend migration applied `006_weave_carbon_v2_audit_ready.sql` to the configured database.
