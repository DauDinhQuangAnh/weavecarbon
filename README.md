# WeaveCarbon — Frontend

Carbon accounting and export-compliance platform for Vietnamese manufacturers,
built with **Next.js (App Router) + TypeScript**. This repo is the web client; it
talks to the Node/Express/PostgreSQL API (`BE_weavecarbon`) and a Python RAG
service for compliance assistance.

## Why it exists

EU **ESPR/DPP**, CSDDD and buyer ESG programs increasingly require a credible,
auditable **product carbon footprint (PCF)** per SKU — something most Vietnamese
SME textile exporters have no tooling or local emission data to
produce. WeaveCarbon turns a factory's bill of materials, energy mix and shipping
legs into an audit-defensible PCF plus the paperwork buyers and customs ask for.

## Core methodology

The carbon engine (`lib/carbon/`) computes an **attributional, climate-only
partial CFP** — a cradle-to-gate core plus a gate-to-market transport extension —
and is deliberately standards-aligned rather than a black box:

- **Standards** — GHG Protocol Product Standard, ISO 14067 / 14040 / 14044, GWP on
  IPCC AR5 (100y).
- **Traceable factors** — a versioned registry (`factorRegistry.ts`) with source
  provenance: DEFRA 2025 freight, IEA 2023 electricity, IPCC AR6, Textile Exchange,
  SAC Higg, and the Vietnam 2023 grid factor — localized for VN materials/accessories.
- **Data quality, made explicit** — every factor carries a 5-dimension *pedigree*
  score (technological / temporal / geographic representativeness, completeness,
  reliability); results expose a data-quality rating, proxy share and Scope 1/2/3
  split by reporting actor.
- **Honest uncertainty** — an RSS model returns a p5–p95 range and a confidence
  level, so a number is never reported without its error bar.

This "show your work" design is what makes a result usable for CBAM-style
pre-audit reporting instead of a rough estimate.

## What's defensible

The moat isn't the formula (it follows public standards *on purpose*) — it's the
**primary-data flywheel**: every assessment adds real Vietnamese supplier/factory
activity data that public databases (Ecoinvent, DEFRA) don't have, compounding into
VN-specific factors competitors can't copy. See the `measured_primary_activity`
vs `proxy` classification in `engine.ts`.

## Product surfaces

Assessment wizard → dashboard & analytics → logistics / shipment tracking →
export & compliance docs → CBAM-style report → evidence & audit trail → Digital
Product Passport. A separate **B2C** flow covers circular/donation.

## Architecture

- **This repo (FE)** — Next.js App Router, React, TypeScript. Global product/shipment
  context with stale-while-revalidate caching; a shared `apiClient` with GET dedup +
  short-TTL cache; a demo mode backed by a local adapter (no real API calls).
- **`BE_weavecarbon`** — Node.js, Express, PostgreSQL; VNPAY payments; OpenAPI at `/api-docs`.
- **`rag/`** — Python / FastAPI: embeddings, semantic chunking, reranking for
  compliance Q&A and market-requirement recommendations.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run check
npm run build
```

## Structure

- `app/` — routes and layouts
- `components/` — UI, dashboard, landing, onboarding, auth, demo
- `contexts/` — shared client state (auth, product, shipment)
- `hooks/`, `lib/` — reusable hooks, API clients, the carbon engine, i18n
- `public/`, `scripts/` — static/demo assets and tooling

## Deployment & guardrails

- Payments redirect to **VNPAY**; the FE expects a public backend via
  `NEXT_PUBLIC_API_BASE_URL`. Full FE+BE+DB VPS stack: `DEPLOY_VPS.md`;
  standalone FE: `DOCKER.md`.
- Keep API payload shapes and route behavior stable; re-run `lint`, `typecheck`
  and `build` after changes. `.next/` and `tsconfig.tsbuildinfo` are generated
  artifacts.

> Disclaimer: WeaveCarbon results are attributional, climate-only partial-CFP
> estimates for decision support and pre-audit preparation — not comparative
> claims, product labels, ISO certifications, or third-party verification.
