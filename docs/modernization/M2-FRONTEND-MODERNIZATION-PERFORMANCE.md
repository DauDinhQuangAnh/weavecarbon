# Macro Phase M2 - Frontend Modernization and Performance

Status: PASS

Baseline commit: `f5e7052`

## Outcome

M2 reduces dashboard-wide client state, establishes one bounded HTTP transport,
defines tenant-safe client-cache ownership, and moves map/chart/QR dependencies
behind on-demand boundaries. User-facing routes and public API behavior remain
compatible.

## State and client boundaries

- `ProductProvider` no longer wraps every dashboard and demo route. It is owned
  only by Overview and the dynamically loaded CBAM report surface that consume
  the product catalog.
- The unused `BatchContext` and `ShipmentContext` client-side sources of truth
  were removed. Active batch and shipment screens already use
  `productsApi`/`logisticsApi` as their authoritative adapters.
- Product catalog hydration remains lazy and uses the backend summary view.
- Summary navigation prefetch is centralized instead of being implemented
  independently in Products and Summary.

## HTTP boundary

All application HTTP now reaches `fetchWithPolicy` through either the shared
`api`/generated OpenAPI client or an explicit external-service adapter.

- Default operation deadline: 15 seconds.
- Idempotent GET/HEAD/OPTIONS calls: at most one retry for network failures or
  transient 408/425/429/502/503/504 responses.
- Mutations: never retried automatically.
- Caller abort signals are preserved; one deadline covers request and backoff.
- Every backend request carries `X-Correlation-ID` unless the caller supplies
  one.
- Timeout and network failures are returned as typed `ApiError` values with
  `CLIENT_TIMEOUT` or `NETWORK_ERROR` codes.
- Authenticated binary image/report/document downloads use the same transport
  and token-refresh behavior as JSON requests.
- `npm run network:check` rejects new direct `fetch()` calls outside the bounded
  transport module.

The previous skipped auth regression is now active: a missing optional cookie
session no longer clears a still-valid bearer token.

## Cache ownership and invalidation

| Cache | Owner | Scope | TTL | Invalidation |
| --- | --- | --- | ---: | --- |
| API GET response/dedupe | `apiClient` | auth status + user + company | 3 s default, bounded override | mutation, auth epoch, adapter change, or resource tag |
| Product catalog snapshot | `ProductProvider` | user + company | 5 min | version change or authoritative refresh overwrite |
| Batch catalog snapshot | removed | n/a | n/a | backend adapter is authoritative |
| Shipment catalog snapshot | removed | n/a | n/a | backend adapter is authoritative |
| Summary product prefetch | `ProductsClient` | user + company | 5 min | expiry/version change/navigation overwrite |
| Subscription response | `subscriptionApi` | current auth token/session | 5 s | auth change or explicit subscription invalidation |

Session-cache envelopes contain an explicit version, creation time and expiry.
Expired or malformed values are removed on read. API cache keys no longer retain
the bearer-token value and remain isolated by user/company session epoch.

## Delivery and performance

- Removed duplicate Google Fonts CSS and the global Mapbox stylesheet. The
  existing self-hosted Next font is now the single body/heading font source.
- Mapbox transport maps load only when their route surface renders.
- Recharts carbon breakdown and QR generation load on demand on product detail
  and logistics surfaces.
- CI runs `performance:check` after production build and enforces route and
  aggregate client-JS budgets.

Measurements use production Turbopack route client-reference manifests. Values
are uncompressed route-associated JavaScript, so they are deterministic build
evidence rather than browser/RUM transfer measurements.

| Route | Before bytes | After bytes | Change |
| --- | ---: | ---: | ---: |
| `/overview` | 800,999 | 805,268 | +0.5% |
| `/products` | 805,807 | 807,303 | +0.2% |
| `/assessment` | 1,086,477 | 1,086,259 | 0.0% |
| `/reports` | 780,161 | 750,288 | -3.8% |
| `/logistics` | 882,770 | 855,714 | -3.1% |
| `/transport` | 2,550,609 | 851,572 | -66.6% |
| `/summary/[slug]` | 1,314,982 | 914,066 | -30.5% |
| `/settings` | 838,845 | 809,074 | -3.5% |
| **Selected route total** | **9,060,650** | **6,879,544** | **-24.1%** |

The complete build contains 198 client chunks and 12,433,806 uncompressed bytes
(3,644,662 independently gzip-compressed bytes). Aggregate build output includes
all lazy features and is not the amount downloaded by one navigation.

## Verification evidence

- `npm run verify:full`: PASS.
- ESLint: PASS with 19 existing React compiler advisory warnings and 0 errors
  (down from 21 after dead context removal).
- TypeScript: PASS.
- OpenAPI snapshot/generated types: current.
- Network boundary audit: PASS.
- Vitest: 31 files and 139 tests passed, 0 skipped.
- Production build: PASS, 62 routes.
- Client bundle budgets: PASS for all eight measured routes and aggregate output.
- Critical regression coverage includes auth/session recovery, dashboard/demo
  adapters, product API, carbon/assessment authority, reports and generated
  OpenAPI transport.

## Rollback

M2 has no database migration. Revert the M2 application commit to restore the
previous frontend. Cache keys are versioned, so old browser entries are ignored
rather than migrated. The backend M1 contract remains backward compatible and
does not need rollback.
