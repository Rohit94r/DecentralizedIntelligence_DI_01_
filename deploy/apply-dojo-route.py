#!/usr/bin/env python3
"""
Route dojo.layerflow.dev → the dojo container (127.0.0.1:3150) in the RUNNING
Caddy, without sudo — the same approach as ~/apps/layerflow/infra/apply-caddy-route.py.

Caddy's admin API (127.0.0.1:2019) reconfigures the running server; a Caddy
restart rebuilds from the root-owned Caddyfile and drops this route, so cron
runs this every 5 minutes to put it back:

  */5 * * * * python3 /home/rohit/apps/dojo/deploy/apply-dojo-route.py >> /home/rohit/dojo-caddy.log 2>&1

SAFETY (same rules as the layerflow script)
  - read-modify-write of the routes array; every existing route is copied through untouched
  - idempotent: exits if the route is already there
  - refuses to write if the routes can't be read
  - inserted BEFORE the first route without a host matcher (a catch-all would hide it)
  - waits until dojo.layerflow.dev resolves to this server, so Caddy doesn't burn
    Let's Encrypt attempts on a name that doesn't exist yet
  - touches no TLS settings and no other host
"""
import json
import socket
import sys
import urllib.error
import urllib.request

ADMIN = "http://127.0.0.1:2019"
ROUTES_PATH = "/config/apps/http/servers/srv0/routes"
HOST = "dojo.layerflow.dev"
UPSTREAM = "localhost:3150"
SERVER_IP = "72.60.99.68"


def api(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(ADMIN + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.status, resp.read()


def hosts_of(route):
    return [h for m in route.get("match", []) for h in m.get("host", [])]


def main():
    try:
        ips = {a[4][0] for a in socket.getaddrinfo(HOST, 443, proto=socket.IPPROTO_TCP)}
    except socket.gaierror:
        print(f"apply-dojo-route: {HOST} has no DNS record yet — waiting")
        return 0
    if SERVER_IP not in ips:
        print(f"apply-dojo-route: {HOST} points at {sorted(ips)}, not {SERVER_IP} — waiting")
        return 0

    try:
        _, body = api("GET", ROUTES_PATH)
        routes = json.loads(body)
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        print(f"apply-dojo-route: cannot read routes ({exc}) — skipped", file=sys.stderr)
        return 1
    if not isinstance(routes, list):
        print("apply-dojo-route: routes is not a list — skipped", file=sys.stderr)
        return 1
    if any(HOST in hosts_of(r) for r in routes):
        print("apply-dojo-route: already present")
        return 0

    ours = {
        "match": [{"host": [HOST]}],
        "handle": [{"handler": "reverse_proxy", "upstreams": [{"dial": UPSTREAM}], "flush_interval": -1}],
        "terminal": True,
    }
    at = next((i for i, r in enumerate(routes) if not hosts_of(r)), len(routes))
    routes.insert(at, ours)

    try:
        status, _ = api("PATCH", ROUTES_PATH, routes)
    except (urllib.error.URLError, OSError) as exc:
        print(f"apply-dojo-route: PATCH failed ({exc})", file=sys.stderr)
        return 1
    _, body = api("GET", ROUTES_PATH)
    if not any(HOST in hosts_of(r) for r in json.loads(body)):
        print("apply-dojo-route: PATCH reported success but the route is absent", file=sys.stderr)
        return 1
    print(f"apply-dojo-route: added at position {at} (HTTP {status}, {len(routes)} routes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
