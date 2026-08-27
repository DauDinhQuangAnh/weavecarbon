# WeaveCarbon CI/CD

## Flow

1. `Frontend CI` and `Backend CI` validate code on pull requests and pushes to `main`.
2. Deploy workflows run only after the matching CI workflow succeeds on `main`.
3. GitHub Actions builds Docker images with BuildKit cache and pushes them to GHCR.
4. The VPS pulls the exact `sha-<commit>` image and restarts only the changed service.

This keeps dependency install and Next.js/API image builds out of the VPS deploy path.

## Required GitHub secrets

Set these secrets in both repositories:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT` optional, defaults to `22`

The deploy workflows use the short-lived GitHub Actions token to log the VPS into GHCR for the image they just built.
If your package permissions are customized, or the VPS must pull images from another repository, set these in both repositories:

- `GHCR_USERNAME`
- `GHCR_TOKEN` with package read permission

The workflows push packages with the built-in `GITHUB_TOKEN`.

## Frontend build variables

Set public build-time values as GitHub Actions repository variables in the frontend repo:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WEAVEY_API_URL`
- `NEXT_PUBLIC_RAG_API_BASE_URL`
- `NEXT_PUBLIC_RAG_COLLECTION`
- `NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER`
- `NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL`
- `NEXT_PUBLIC_RAG_TIMEOUT_MS`
- `NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL`
- `NEXT_PUBLIC_AUTH_DISABLED`
- `NEXT_PUBLIC_ACCOUNT_ENDPOINT`
- `NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD`

Use `NEXT_PUBLIC_MAPBOX_TOKEN` as a repository secret if you do not want it visible in the Variables UI.

## VPS `.env.vps`

The compose file uses these image variables:

```env
FE_IMAGE=ghcr.io/daudinhquanganh/weavecarbon:latest
BE_IMAGE=ghcr.io/daudinhquanganh/be_weavecarbon:latest
BACKEND_SCHEMA_PATH=../BE_weavecarbon/DATABASE_SCHEMA.sql
```

Deploy workflows override `FE_IMAGE` or `BE_IMAGE` with the exact commit tag during deployment.

## Manual VPS commands

From `/opt/weavecarbon/FE`:

```bash
bash deploy/redeploy-vps.sh
bash deploy/redeploy-vps.sh --frontend-only
bash deploy/redeploy-vps.sh --backend-only
```

## Private RAG preflight

RAG is an internal-only service. Before deploying a revision that enables the
private RAG route, add one shared, randomly generated value to the VPS
`/opt/weavecarbon/FE/.env.vps`:

```bash
RAG_INTERNAL_API_KEY=<output of: openssl rand -hex 32>
RAG_REQUIRE_INTERNAL_API_KEY=true
RAG_CORS_ORIGINS=
RAG_ROOT_PATH=
```

The value is injected into both the backend and RAG containers; it must never be
added to Git, a `NEXT_PUBLIC_*` variable, logs, or browser configuration. The
deployment script validates that the value is non-placeholder and at least 32
characters before any container cleanup or restart. Caddy intentionally has no
public `/rag` route; browser traffic must use authenticated `/api/chat/*` or
`/api/ai-config/rag/*` backend routes.
