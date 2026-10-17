# dojo.layerflow.dev: how it's hosted

Layerflow (DI-01 Debug Dojo) runs on a **shared** VPS (`72.60.99.68`, user `rohit`) next to `layerflow.dev`, which must not be touched.

## Rules of this box (from `~/WELCOME.txt`)
- No sudo, by design. Rootless Docker + Compose only.
- Container ports only in **3100–3200**. `3100` (api.layerflow.dev) and `3200` (layerflow.dev) are taken, so dojo uses **3150**.
- Shared memory budget, so dojo is capped at 1 GB and 1 CPU, with a small sandbox pool (2 warm runners, 2 at most).

## Layout
```
https://dojo.layerflow.dev        → Caddy → 127.0.0.1:3150 → container dojo-web
                                            ├─ website  (Next.js :3000)
                                            └─ API      (Fastify :4000, inside the container only)
https://dojo.layerflow.dev/api/*  → the same container; the website proxies /api to the API
                                    → this is the base URL for the APP as well
```
- Code: `~/apps/dojo` · secrets: `~/apps/dojo/.env` (chmod 600, never in git)
- Data (SQLite): Docker volume `deploy_dojo-data`
- Caddy route: `deploy/apply-dojo-route.py`, re-applied every 5 minutes by cron (a Caddy restart drops admin-API routes). It only adds the route once `dojo.layerflow.dev` resolves to this server. Log: `~/dojo-caddy.log`.

## DNS (one time)
At Spaceship (the DNS host for layerflow.dev): add an **A record**, host `dojo`, value `72.60.99.68`. Within 5 minutes the cron adds the Caddy route and Caddy fetches the HTTPS certificate on its own.

## Redeploy
```bash
cd ~/apps/dojo
# copy the new code in (tarball or git), keep .env
docker compose -f deploy/docker-compose.dojo.yml up -d --build
docker compose -f deploy/docker-compose.dojo.yml logs -f --tail 50
curl -s 127.0.0.1:3150/api/health
```

## Useful
| | |
|---|---|
| status | `docker ps --filter name=dojo-web` · `docker stats --no-stream dojo-web` |
| logs | `docker logs -f --tail 100 dojo-web` |
| restart | `docker restart dojo-web` |
| reset demo data | `curl -X POST -H "x-admin-token: $TOKEN" https://dojo.layerflow.dev/api/dev/reset` (`LAYERFLOW_ADMIN_TOKEN` is in `.env`) |
| route check | `python3 ~/apps/dojo/deploy/apply-dojo-route.py` |
