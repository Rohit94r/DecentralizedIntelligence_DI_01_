#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Debug Dojo — VPS deploy
#
#   ssh you@vps 'cd /opt/debug-dojo && bash deploy/deploy.sh'
#
# ⚠️ MUST be a full `npm install`, never `--omit=dev` — tsx and typescript are
#    devDependencies but tsx is what actually RUNS the TypeScript at runtime.
#
# Idempotent: safe to re-run. Pulls, builds, restarts, then health-checks.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/debug-dojo}"
PORT="${PORT:-3000}"
API_PORT="${LAYERFLOW_API_PORT:-4000}"

cd "$APP_DIR"

echo "▸ node        $(node -v)"
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "✗ Node 22.13+ required (the sandbox uses node --permission). Found $(node -v)" >&2
  exit 1
fi

echo "▸ fetching code"
git fetch --all --prune
git pull --ff-only origin main

echo "▸ installing dependencies (full — tsx is needed at runtime)"
# sharp/fsevents have postinstall scripts npm may block on newer versions
npm install --no-audit --no-fund || npm install --no-audit --no-fund --ignore-scripts=false

echo "▸ building the web app"
( cd apps/web && npx next build )

echo "▸ restarting the service"
sudo systemctl restart debug-dojo
sleep 4

echo "▸ health check"
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "✓ healthy after ${i}s"
    curl -s "http://127.0.0.1:${PORT}/api/health" | head -c 400; echo
    echo
    echo "  Public:  http://$(curl -s ifconfig.me 2>/dev/null || echo '<VPS-IP>'):${PORT}/"
    echo "  Judges:  /judges"
    exit 0
  fi
  sleep 1
done

echo "✗ did not become healthy — logs:" >&2
sudo journalctl -u debug-dojo -n 40 --no-pager >&2
exit 1