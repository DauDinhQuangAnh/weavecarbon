# Docker guide

## 1. Build and run with Docker Compose

Make sure `.env` contains the values you want to use for production, then run:

```bash
docker compose up --build -d
```

App will be available at `http://localhost:3000`.

To stop it:

```bash
docker compose down
```

## 2. Build and run with plain Docker

Example build:

```bash
docker build -t weavecarbon-fe ^
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com ^
  --build-arg NEXT_PUBLIC_RAG_API_BASE_URL=https://your-rag.example.com ^
  .
```

Example run:

```bash
docker run -d --name weavecarbon-fe -p 3000:3000 --env-file .env weavecarbon-fe
```

## 3. Important note about environment variables

This app uses several `NEXT_PUBLIC_*` variables inside client-side code. In Next.js these values are typically baked into the frontend bundle at build time.

That means:

- changing `NEXT_PUBLIC_*` usually requires rebuilding the Docker image
- server-only variables such as `BACKEND_HEALTH_URL` can still be changed at runtime
- if your backend runs on the host machine, avoid `localhost` for server-side container calls and prefer `http://host.docker.internal:<port>`

## 4. Files added

- `Dockerfile`: multi-stage production build for Next.js
- `.dockerignore`: keeps the build context small
- `docker-compose.yml`: easiest local/prod-like startup flow

## 5. Full VPS stack

If you want to run frontend + backend + database together on one VPS, use:

- `docker-compose.vps.yml`
- `.env.vps.example`
- `DEPLOY_VPS.md`
