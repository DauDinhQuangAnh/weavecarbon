# WeaveCarbon VPS Deployment

This guide runs the full stack on one VPS with Docker:

- `db`: PostgreSQL
- `be`: Express backend
- `fe`: Next.js frontend
- `proxy`: Caddy reverse proxy

## 1. Recommended folder layout on VPS

Clone the two repos as siblings:

```bash
/opt/weavecarbon/
  Weavecarbon/
  BE_weavecarbon/
```

Example:

```bash
sudo mkdir -p /opt/weavecarbon
sudo chown -R $USER:$USER /opt/weavecarbon
cd /opt/weavecarbon

git clone <your-fe-repo-url> Weavecarbon
git clone <your-be-repo-url> BE_weavecarbon
```

## 2. Install Docker

Ubuntu/Debian example:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Log out and back in once after adding your user to the `docker` group.

## 3. Prepare environment

Inside the FE repo:

```bash
cd /opt/weavecarbon/Weavecarbon
cp .env.vps.example .env.vps
```

Edit `.env.vps` and set at least:

- `APP_DOMAIN`
- `APP_PUBLIC_URL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Optional but recommended:

- SMTP (`EMAIL_*`)
- VNPay (`VNPAY_*`)
- Google OAuth (`GOOGLE_*`)
- Mapbox (`NEXT_PUBLIC_MAPBOX_TOKEN`)

## 4. DNS and ports

If you have a real domain:

- point the A record of your domain to the VPS IP
- open ports `80` and `443`
- keep `APP_DOMAIN=your-domain.com`
- keep `APP_PUBLIC_URL=https://your-domain.com`

If you want to test quickly by VPS IP first:

- set `APP_DOMAIN=:80`
- set `APP_PUBLIC_URL=http://YOUR_VPS_IP`
- open port `80`

## 5. Start the full stack

```bash
cd /opt/weavecarbon/Weavecarbon
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

Check status:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml ps
```

Check logs:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml logs -f
```

## 6. Notes

- The PostgreSQL container auto-initializes from `../BE_weavecarbon/DATABASE_SCHEMA.sql` on the first boot only.
- Backend runtime still creates some supplemental tables lazily when needed.
- Uploaded backend files persist in the `be_uploads` Docker volume.
- Database data persists in the `postgres_data` Docker volume.
- Frontend talks to backend through the same public domain using `/api`.

## 7. Reset everything

Warning: this removes the database volume too.

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml down -v
```

Then start again with `up -d --build`.

## 8. Update deployment after code changes

```bash
cd /opt/weavecarbon/Weavecarbon
git pull
cd /opt/weavecarbon/BE_weavecarbon
git pull
cd /opt/weavecarbon/Weavecarbon
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```
