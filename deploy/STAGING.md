# Isolated VPS staging

This staging stack is intentionally separate from production:

- Compose project: `weavecarbon-staging`
- Suggested checkout root: `/opt/weavecarbon-staging`
- Database volume: `weavecarbon-staging_postgres_data`
- Upload volume: `weavecarbon-staging_be_uploads`
- HTTP bind: `127.0.0.1:18080` by default
- No RAG service, production database, production upload volume or production proxy dependency

The loopback bind is a safety feature. Access the staging UI through an SSH tunnel:

```bash
ssh -L 18080:127.0.0.1:18080 root@SERVER
```

Then open `http://127.0.0.1:18080`. Do not change the bind address to `0.0.0.0` without a firewall, authentication and an
explicit exposure review.

## Required checkout layout

```text
/opt/weavecarbon-staging/
  BE/  # BE_weavecarbon, feature branch
  FE/  # weavecarbon, feature branch
```

The compose file lives at `FE/deploy/docker-compose.staging.yml`; its relative build and schema paths depend on this layout.

## Environment

Create `/opt/weavecarbon-staging/FE/.env.staging` with mode `0600` and these keys:

```env
COMPOSE_PROJECT_NAME=weavecarbon-staging
POSTGRES_DB=weavecarbon_staging
POSTGRES_USER=weavecarbon_staging
POSTGRES_PASSWORD=<random>
JWT_SECRET=<random-at-least-32-bytes>
JWT_REFRESH_SECRET=<different-random-at-least-32-bytes>
RAG_INTERNAL_API_KEY=<random-at-least-32-bytes>
STAGING_BIND_ADDRESS=127.0.0.1
STAGING_HTTP_PORT=18080
STAGING_PUBLIC_URL=http://127.0.0.1:18080
```

Never copy production database credentials into this file.

## Build and start

From `/opt/weavecarbon-staging/FE`:

```bash
docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml build be
docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml build fe
docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml up -d
docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml ps
curl --fail --show-error http://127.0.0.1:18080/ready
```

Building serially limits CPU/RAM pressure on a shared VPS. The backend starts only after its dedicated database is healthy
and applies migrations to that database before serving traffic.

## Production non-interference checks

Before and after staging work, record:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
git -C /opt/weavecarbon/FE status -sb
git -C /opt/weavecarbon/BE_Carbon-main status -sb
curl --fail --show-error https://weavecarbon.com/
```

Production containers must remain under the `weavecarbon-*` project. Staging containers must be named
`weavecarbon-staging-*`; staging must not mount any `weavecarbon_*` volume.
