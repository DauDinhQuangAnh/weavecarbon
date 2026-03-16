# WeaveCarbon VPS Deployment

This guide runs the full stack on one Ubuntu 22.04 VPS with Docker:

- `db`: PostgreSQL
- `be`: Express backend
- `fe`: Next.js frontend
- `proxy`: Caddy reverse proxy with HTTPS

The public entrypoint stays on one domain:

- `/` -> frontend
- `/api/*` -> backend
- `/health` -> backend

## 1. Recommended folder layout on VPS

Keep the FE and BE repos as siblings:

```bash
/opt/weavecarbon/
  FE/
  BE_Carbon-main/
```

Example:

```bash
sudo mkdir -p /opt/weavecarbon
sudo chown -R $USER:$USER /opt/weavecarbon
cd /opt/weavecarbon

git clone <your-fe-repo-url> FE
git clone <your-be-repo-url> BE_Carbon-main
```

## 2. Install Docker on Ubuntu 22.04

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Log out and back in once after adding your user to the `docker` group.

## 3. Open ports and point DNS

At minimum open:

- `22/tcp`
- `80/tcp`
- `443/tcp`

If you use `ufw`:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Then point your domain A record to `163.44.207.217`.

Important:

- Caddy can issue HTTPS certificates only after the domain resolves to the VPS.
- Do not use the local development `.env` file for production builds.
- The frontend bakes `NEXT_PUBLIC_*` values into the image during `docker build`.

## 4. Create the production env file

Inside the FE repo:

```bash
cd /opt/weavecarbon/FE
cp .env.vps.example .env.vps
```

Edit `.env.vps` and fill in the required values:

- `APP_DOMAIN=your-domain.com,www.your-domain.com`
- `APP_PUBLIC_URL=https://your-domain.com`
- `BACKEND_REPO_PATH=../BE_Carbon-main`
- `POSTGRES_DB=weavecarbon`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=<strong-secret>`
- `JWT_SECRET=<strong-secret>`
- `JWT_REFRESH_SECRET=<strong-secret>`
- `FRONTEND_URLS=https://your-domain.com,https://www.your-domain.com`
- `CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- `NEXT_PUBLIC_API_BASE_URL=/api`

Defaults already set in the example file:

- `BACKEND_HEALTH_URL=http://be:4000/health`
- `VNPAY_MODE=mock`
- Google OAuth vars empty
- RAG vars empty
- Mapbox optional

## 5. Preflight the Docker config

Always validate the merged compose config before the first deploy:

```bash
cd /opt/weavecarbon/FE
docker compose --env-file .env.vps -f docker-compose.vps.yml config
```

Check that:

- `be.build.context` resolves to `../BE_Carbon-main`
- `DATABASE_SCHEMA.sql` bind mount also resolves to `../BE_Carbon-main`
- FE build args use production-safe values like `NEXT_PUBLIC_API_BASE_URL=/api`

## 6. Start the full stack

```bash
cd /opt/weavecarbon/FE
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

Check status:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml ps
```

Follow logs:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml logs -f
```

## 7. Verify after deploy

HTTP and HTTPS:

```bash
curl -I http://your-domain.com
curl https://your-domain.com/health
```

In the browser:

- open `https://your-domain.com`
- confirm FE requests go to `/api/...`
- confirm the app is not calling `localhost` or old `ngrok` URLs

Auth smoke test:

- sign up a new account
- receive the verification email from your SMTP provider
- verify the email
- sign in successfully
- confirm sign-in is blocked before email verification

Persistence checks:

- restart the containers
- confirm Postgres data still exists
- confirm uploaded backend files still exist

## 8. Update after code changes

```bash
cd /opt/weavecarbon/FE
git pull
cd /opt/weavecarbon/BE_Carbon-main
git pull
cd /opt/weavecarbon/FE
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

Remember:

- changing `NEXT_PUBLIC_*` values requires rebuilding the FE image
- changing runtime-only values like SMTP or DB credentials only requires recreating containers

## 9. Backup the database

Example backup:

```bash
mkdir -p ~/backups
docker exec -t weavecarbon-db pg_dump -U postgres -d weavecarbon > ~/backups/weavecarbon-$(date +%F-%H%M).sql
```

If your DB name or user differs, replace `postgres` and `weavecarbon` with the values from `.env.vps`.

## 10. Reset everything

Warning: this removes the Postgres volume too.

```bash
cd /opt/weavecarbon/FE
docker compose --env-file .env.vps -f docker-compose.vps.yml down -v
```

Then start again with:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

## 11. Important notes

- PostgreSQL auto-initializes from `${BACKEND_REPO_PATH}/DATABASE_SCHEMA.sql` only on the first boot of a fresh DB volume.
- Backend uploads persist in the `be_uploads` Docker volume.
- Database data persists in the `postgres_data` Docker volume.
- Caddy stores certificates in Docker volumes and renews them automatically.
- Keep `.env.vps` only on the server and out of version control.

## 12. GitHub Actions CI/CD

This repo includes:

- `.github/workflows/frontend-ci.yml`
- `.github/workflows/frontend-deploy.yml`
- `deploy/redeploy-vps.sh`

The deploy workflow:

- runs FE validation on GitHub Actions
- SSHes into the VPS
- pulls the latest `main` branch for both FE and BE repos
- runs `docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build`

Add these GitHub repository secrets in the FE repo:

- `DEPLOY_HOST=163.44.207.217`
- `DEPLOY_PORT=22`
- `DEPLOY_USER=root`
- `DEPLOY_SSH_KEY=<private key content for the VPS>`

Use the same `DEPLOY_*` secrets in the BE repo as well, because the backend repo also has its own deploy workflow.

If those secrets are missing, the deploy workflow still starts but exits cleanly with a skip message instead of failing syntax validation.
