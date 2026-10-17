# Layerflow (DI-01 Debug Dojo) — one container: the website (Next.js :3000) and
# the API (Fastify :4000, internal) with the Pyodide sandbox. The website proxies
# /api/* to the API, so ONE port serves the website and the app.
#
#   docker compose -f deploy/docker-compose.dojo.yml up -d --build
FROM node:24-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# dependencies first (cached between code changes). Full install: tsx runs the
# TypeScript API at runtime, so dev dependencies are needed.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/runner/package.json apps/runner/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
# the website's /api rewrite is baked in at build time → the API inside this container
RUN cd apps/web && LAYERFLOW_API_URL=http://127.0.0.1:4000 npx next build

ENV NODE_ENV=production \
    PORT=3000 \
    LAYERFLOW_API_PORT=4000 \
    LAYERFLOW_API_HOST=127.0.0.1
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
