# Protected navigation and pages

The user instructed on 2026-10-06: do not change the existing Tổng quan, Sản phẩm, Logistics, Tính carbon, Chứng từ, Xuất khẩu, Báo cáo, Audit Trail or Gói dịch vụ menu/page behavior. Their paths are `/overview`, `/products`, `/logistics`, `/carbon-calculator`, `/evidence`, `/export`, `/reports`, `/audit-trail`, `/billing`. Keep labels, icons, relative order, URLs, permissions, workflows, demo versions and shared dependencies intact. Only the remaining menus/pages may be updated or added. Preserve all prior working changes.

The shared sidebar is the authorized navigation exception. Protected descriptors and visibility must keep passing `lib/dashboard/navigation.test.ts` and `components/dashboard/DashboardSidebar.navigation.test.tsx`.

Run `node scripts/check-protected-pages.mjs` before and after editing. It checks the captured working content of FE dependencies and sibling BE source. Standalone FE CI uses `--frontend-only`. Never refresh the snapshot to conceal a change. Add isolated files for new functions; do not edit protected files unless the user later explicitly changes this instruction.

Use the Downloads Lovable project as a navigation reference and the 12 September Word document as the requirements vision. Reuse this application's APIs and auth; do not replace it with Lovable's Supabase implementation. Show source-backed results; label demo data and missing capabilities honestly. Never imply internal review or DQL is independent verification. Industrial writes require `isRoot && canMutate && !demo` and backend tenant checks.

Verify tests, `npm run check`, production build and existing bundle budgets. Do not deploy, migrate a live database or invoke paid providers for menu work.
