# Cleanup Audit

Wave 1 is limited to low-risk cleanup that does not change FE or BE runtime contracts.

## Completed

- Removed unused FE components:
  - `components/demo/DemoBanner.tsx`
  - `components/dashboard/reports/mobile/MobileFilterSheet.tsx`
  - `components/ui/alert.tsx`
- Removed BE debug script:
  - `D:/test/Weavecarbon/BE_Carbon-main/tmp-debug-company.js`
- Removed unused FE dependencies:
  - `@google/generative-ai`
  - `leaflet`
  - `@types/leaflet`
  - `next-themes`
  - `react-router-dom`
- Added verification scripts:
  - FE: `npm run typecheck`, `npm run check`
  - BE: `npm run check:syntax`

## Verified

- FE lint passes
- FE typecheck passes
- FE production build passes
- BE syntax check passes

## Remaining Priority Areas

### FE

- Split large modules without changing exports:
  - `lib/productsApi.ts`
  - `lib/exportComplianceApi.ts`
  - `lib/logisticsApi.ts`
  - `components/dashboard/reports/ReportClient.tsx`
  - `components/dashboard/SummaryClient.tsx`
  - `components/dashboard/export/ExportClient.tsx`
- Review generated/static weight:
  - `.next/`
  - `public/textures/sequence/`
  - `public/hdri/`

### BE

- Split oversized services:
  - `src/services/exportMarketsService.js`
  - `src/services/productsService.js`
  - `src/services/logisticsService.js`
  - `src/services/subscriptionService.js`
- Keep route and response contracts unchanged while extracting:
  - query helpers
  - payload mappers
  - validation helpers
  - shared error builders

## Manual Review Queue

- FE generated artifacts:
  - `.next/`
  - `tsconfig.tsbuildinfo`
- BE manual helper left in place:
  - `D:/test/Weavecarbon/BE_Carbon-main/generate-hash.js`
- BE runtime data:
  - `D:/test/Weavecarbon/BE_Carbon-main/uploads/`
