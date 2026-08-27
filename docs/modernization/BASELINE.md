# WP-0A Frontend Baseline

- Date: 2026-08-27
- Repository: `D:\hoctap\WCB\Weavecarbon`
- Remote: `https://github.com/DauDinhQuangAnh/weavecarbon.git`
- Baseline commit: `2ce0926` (`fix(report): simplify open state check and enhance product facility details in report adapter`)
- Working branch: `codex/wp-0a-baseline`

WP-0A result: **PASS** — inventory is complete; pre-existing warnings and cross-repository blockers are recorded below.

## Scope and invariants

This work package changed documentation only. It did not refactor runtime code, change an API contract, modify the carbon methodology, run a database migration, access production data, or deploy anything.

## Runtime and repository inventory

- Next.js App Router application with TypeScript, React 19 and Next.js 16.
- Package manager: npm with committed `package-lock.json`.
- Local diagnostic runtime: Node `v24.11.1`, npm `11.6.4`, loaded from `D:\hoctap\node`.
- CI and Docker target Node 22, so local and CI major versions currently differ.
- 656 tracked files and 22 tracked test files at the baseline commit.
- Main application surfaces are under `app/`; authenticated dashboard routes include assessment, products, logistics, evidence, reports, audit, passport, suppliers and billing. A parallel demo route tree is intentionally supported.
- Shared client state is held in `AuthContext`, `BatchContext`, `DashboardContext`, `ProductContext` and `ShipmentContext`.
- The stable backend transport import is `lib/apiClient.ts`; implementation is split under `lib/apiClient/` and includes token/session handling, GET deduplication and response caching.
- Demo mode replaces the transport through `lib/demo/apiAdapter.ts`. This adapter is a compatibility boundary and must remain functional during transport refactors.
- The authoritative implementation today is still the browser carbon engine in `lib/carbon/`:
  - `engine.ts` — calculation logic;
  - `factorRegistry.ts` — emission factors and provenance;
  - `adapters.ts` — UI/domain adaptation;
  - `types.ts` — carbon types;
  - `engine.test.ts` — existing parity/regression coverage.
- Report/export code exists in `lib/reports/` and `lib/weave-v2/` and currently consumes frontend/domain carbon data. It is a compatibility boundary for the later server-authority work packages.

## Cross-service contracts

### Frontend to backend

- `lib/apiClient/request.ts` normalizes `NEXT_PUBLIC_API_BASE_URL` to an `/api` base; its default is `/api`.
- The frontend expects the backend response envelope to support `success`, `data`, `message` and structured `error` fields.
- Authentication refresh/session behavior, error codes, cache invalidation, demo adapter interception and the stable `@/lib/apiClient` import path must not change accidentally.
- Actively used domains include auth/account, dashboard, products, batches, logistics, carbon calculations, evidence, reports, export/compliance, suppliers, data gaps, audit trail, subscriptions and chat.
- No generated OpenAPI transport artifact is present. Most transport DTOs are maintained by hand.

### Frontend to RAG

- Most collection administration, health, ingest and query calls in `lib/ragApi.ts` go through backend proxy routes under `/api/ai-config/rag/*`.
- Chat and recommendation calls in `lib/chatApi.ts` go through `/api/chat/*`.
- `generateProductSuggestions` and `generateCompanyRecommendations` in `lib/ragApi.ts` still use the direct `ragRequest` path and a browser-configurable RAG base URL. These are security-sensitive compatibility boundaries for `WP-S2`.
- The default browser-visible RAG URL is `https://weavecarbon.com/rag`.

## Environment variables

No `.env` values were read or copied into this document. `.env` and `.env.local` are ignored and are not tracked.

Browser-visible configuration (never treat these as secrets):

- `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_AUTH_DISABLED`, `NEXT_PUBLIC_ACCOUNT_ENDPOINT`, `NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD`
- `NEXT_PUBLIC_WEAVEY_API_URL`, `NEXT_PUBLIC_RAG_API_BASE_URL`, `NEXT_PUBLIC_RAG_COLLECTION`, `NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER`, `NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL`, `NEXT_PUBLIC_RAG_TIMEOUT_MS`
- `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL`, `NEXT_PUBLIC_MAPBOX_DIRECTIONS_BASE_URL`

Frontend server/container non-secret configuration:

- `BACKEND_HEALTH_URL`, `AI_CONFIG_CONSOLE_ENABLED`, `PORT`, `HOSTNAME`, `NODE_ENV`

Deployment secrets referenced by `.env.vps.example` or GitHub Actions and required to remain server-side:

- PostgreSQL password, JWT secrets, email password, VNPAY hash secret, Google client secret, Gemini/Hugging Face credentials, SSH deploy key and registry token.
- Public-prefixed variables are compiled into the browser bundle, including the Mapbox token.

## Docker and deployment topology

- `Dockerfile` is multi-stage, installs with `npm ci`, builds Next standalone output and runs as non-root user `nextjs` on port 3000.
- Local `docker-compose.yml` exposes frontend port `3000:3000`.
- `docker-compose.vps.yml` is the current cross-repository deployment source of truth. It defines PostgreSQL 16, backend on port 4000 internally, RAG on port 8000 internally, frontend on 3000 internally and Caddy on public ports 80/443.
- Persistent volumes: `postgres_data`, `be_uploads`, `rag_data`, `rag_cache`, `caddy_data`, `caddy_config`.
- Caddy proxies `/api/*` and `/health` to the backend and publicly proxies `/rag/*` to RAG.
- The production compose file does not currently inject `RAG_INTERNAL_API_KEY` or `RAG_REQUIRE_INTERNAL_API_KEY`. This is a P0 finding and makes `WP-S2` the immediate safety follow-up.

## CI/CD inventory

- `frontend-ci.yml`: PR and `main` checks for dependency audit (advisory), lint/typecheck, unit tests and production build; superseded CI runs are cancelled.
- `dependency-audit.yml`: scheduled dependency audit with issue creation.
- `frontend-deploy.yml`: after successful frontend CI, builds and pushes GHCR images tagged by commit SHA plus mutable `main`/`latest`, then SSHes to the VPS and runs `deploy/redeploy-vps.sh --frontend-only`.
- Deployment still performs a `git pull` on the VPS before invoking the deployment script, so the complete deployment process is not yet a pure immutable-artifact promotion flow.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| Git pre-check | PASS | `main` was clean and tracked `origin/main`; branch `codex/wp-0a-baseline` created. |
| `npm run lint` | PASS with pre-existing warnings | Exit 0; 32 warnings, 0 errors. Main groups: synchronous state updates in effects, render purity/static-component/ref warnings and unused imports. |
| `npm run typecheck` | PASS | Exit 0. |
| `npm test` | PASS | 22 files passed; 113 tests passed; 1 skipped. |
| `npm run build` | PASS | Next.js 16.3.0 production build completed; 62 pages were generated/analysed by the build. |
| Docker build/image inspection | UNAVAILABLE | Docker CLI/daemon is not installed or available in the current execution environment. Deferred to `WP-0B` or a Docker-capable host. |

## Pre-existing findings and risks

1. **P0 — RAG exposure:** Caddy publicly routes `/rag/*`; the current production compose does not provide internal-auth variables. Run `WP-S2` immediately after WP-0A.
2. **P0 compatibility boundary — carbon authority:** calculations and factor resolution remain frontend-owned. Do not change formulas before `WP-CARB1` golden fixtures exist.
3. **Contract drift risk:** frontend DTOs are manual while backend OpenAPI currently covers only a small part of the live API.
4. **Direct RAG transport remains:** two recommendation methods bypass the backend proxy.
5. **Tracked runtime artifact:** `.devserver.log` is tracked even though it is runtime output. Do not remove it in WP-0A; evaluate it in `WP-S3`.
6. **Toolchain drift:** local Node 24 differs from Node 22 used by CI/Docker.
7. **Warnings accepted by the current gate:** lint exits successfully with 32 warnings; later work must not misclassify them as newly introduced failures.

## Likely performance-sensitive paths (not yet measured)

- Product/shipment context hydration and dashboard overview requests.
- Large report XLSX/PDF generation in browser-side libraries.
- Carbon recalculation during assessment editing.
- Mapbox/MapLibre/Three/Recharts route bundles.
- RAG query/recommendation calls and broad client boundaries under dashboard routes.

Measurements and budgets belong to `WP-0B`; no performance improvement is claimed here.

## Rollback

Delete this documentation file and revert the WP-0A documentation commit. No runtime rollback, migration rollback or data restore is required.
