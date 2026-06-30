# WeaveCarbon FE

Frontend for the WeaveCarbon platform, built with Next.js App Router and TypeScript.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run check
npm run build
```

## Structure

- `app/`: route entry points and layouts
- `components/`: UI, dashboard, landing, onboarding, auth, demo
- `contexts/`: shared client state providers
- `hooks/`: reusable React hooks
- `lib/`: API clients, domain helpers, i18n, demo adapters
- `public/`: static assets, demo documents, 3D assets
- `scripts/`: utility scripts for i18n and demo assets

## Cleanup Baseline

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run build` passes

## Payment Integration

- Standard checkout now redirects to VNPAY instead of showing a local QR popup
- FE expects a public backend via `NEXT_PUBLIC_API_BASE_URL`
- For full FE + BE Docker deployment on one VPS, use `DEPLOY_VPS.md`

## Docker

- Standalone FE Docker flow: `DOCKER.md`
- Full FE + BE + DB VPS stack: `DEPLOY_VPS.md`

## Refactor Guardrails

- Keep API payload shapes and route behavior unchanged
- Avoid editing files with active local changes until they are reviewed separately
- Treat `.next/` and `tsconfig.tsbuildinfo` as generated artifacts
- Re-check `lint`, `typecheck`, and `build` after each cleanup wave
