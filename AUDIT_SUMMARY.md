 # Audit Summary

 ## Executive Summary

 The audit mapped 91 distinct frontend UI functions across navigation, client-only interactions, and server/API actions. Runtime validation passed for frontend lint/typecheck/build/check and a bounded frontend root-route dev probe. Backend syntax, migration, and bounded `/health` probe also passed.

 No UI action is marked `WORKING` from static inspection alone. Most actions remain `NEEDS_MANUAL_TEST` because they require authenticated sessions, seeded data, browser interaction, file uploads, payment/OAuth/email providers, Mapbox, or RAG services. Demo/local-storage flows are marked `MOCK`.

 ## Totals

 Total UI actions audited: 91

 | Status | Count |
 | ------ | ----- |
 | WORKING | 0 |
 | PARTIAL | 7 |
 | MOCK | 5 |
 | BROKEN | 0 |
 | MISSING_BACKEND | 2 |
 | NEEDS_MANUAL_TEST | 77 |

 ## Top 10 Bugs

 | Rank | Bug ID | Severity | Summary | First Fix Area |
 | ---- | ------ | -------- | ------- | -------------- |
 | 1 | BUG-003 | High | B2C coupon redeem CTA has no discovered backend/API implementation. | B2C coupons |
 | 2 | BUG-004 | High | Evidence backend/wrappers exist, but visible create/lock UI was not found. | Evidence/export UI |
 | 3 | BUG-005 | High | Subscription/payment endpoints use non-baseline response shapes. | Subscription API contract |
 | 4 | BUG-006 | High | DPP lock falls back to local payload when remote lock fails. | Export V2 DPP |
 | 5 | BUG-007 | Medium | Buyer webhook payload falls back to local JSON when backend fails. | Export V2 webhook |
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

 - Frontend dev probe returned HTTP 200 on `/` and was stopped.
 - Backend dev probe returned HTTP 200 on `/health` on port 4100 and was stopped.
 - `npm run ...` is blocked by PowerShell execution policy in this shell; `npm.cmd run ...` works.
 - Backend migration applied `006_weave_carbon_v2_audit_ready.sql` to the configured database.
