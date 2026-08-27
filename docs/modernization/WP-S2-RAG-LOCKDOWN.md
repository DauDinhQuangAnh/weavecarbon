# WP-S2 RAG Lockdown

- Date: 2026-08-27
- Scope: frontend transport, VPS Compose, Caddy and deployment preflight
- Status: implementation verified; production activation requires a VPS-only shared key

## Outcome

RAG is no longer a browser-addressable service. Caddy exposes only the frontend
and authenticated backend API. Recommendation compatibility helpers now call
`/api/chat/*`; no helper can use its caller-supplied RAG URL for browser `fetch`.
The RAG container remains reachable only on the Compose network.

Production Compose injects the same `RAG_INTERNAL_API_KEY` into backend and RAG,
forces strict mode, disables RAG browser CORS and removes the former `/rag` root
path. The key is required, must be at least 32 non-placeholder characters, and is
validated before the deployment script cleans up or restarts containers.

## Deployment precondition

Before the first secure full-stack deployment, set the following in the VPS
`/opt/weavecarbon/FE/.env.vps` (never commit the generated value):

```env
RAG_INTERNAL_API_KEY=<one unique value from openssl rand -hex 32>
RAG_REQUIRE_INTERNAL_API_KEY=true
RAG_CORS_ORIGINS=
RAG_ROOT_PATH=
```

If the key is absent or weak, deployment stops before container mutation and the
currently running stack remains in place. A push to `main` may therefore produce
a safe failed deployment until this VPS precondition is fulfilled.

## Verification evidence

| Gate | Result |
| --- | --- |
| ESLint | PASS with the same 32 pre-existing warnings; no new warning |
| TypeScript | PASS |
| Vitest | PASS, 115 tests and 1 skipped |
| Next production build | PASS, 62 pages generated |
| RAG adapter regression tests | PASS, 2 tests prove backend routing and no browser fetch |
| Compose/Caddy static invariants | PASS: no RAG host port, internal expose only, no Caddy RAG upstream |
| Deployment script syntax | PASS with Git Bash |
| Docker Compose render/runtime smoke | UNAVAILABLE: Docker is not installed locally |

## Safe rollback

Do not restore the public Caddy `/rag` route. If application compatibility must
be rolled back, revert the RAG and backend WP-S2 commits while retaining the
private network boundary and shared key, then redeploy the full stack. Revert the
frontend adapter last only if required. Verify backend chat/recommendations and
confirm public `/rag/*` remains unreachable after rollback.
