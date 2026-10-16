/**
 * Fetches a public web page for Website Analyse — carefully, because the URL
 * comes from a user and the request comes from our server:
 *
 *   • only http(s) on the standard ports, and no user:password@ in the URL
 *   • every host is resolved first and refused if any address is private
 *     (localhost, 10.x, 192.168.x, 169.254.169.254 cloud metadata, …); the
 *     connection then uses exactly the address we checked, so the DNS answer
 *     can't be swapped between the check and the request
 *   • redirects are followed by hand (at most 5), each hop checked again
 *   • small and polite: 3 MB per page, a few seconds per request, about a
 *     dozen follow-up requests (robots.txt, sitemap, security.txt, a sample
 *     of the page's files), and a User-Agent that says who we are
 */
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { pickResources, type SiteFetch, type SiteResource } from "@layerflow/core";

export class SiteError extends Error {
  /** the message is written for the user — show it even for 5xx */
  readonly expose = true;
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

const UA = "Mozilla/5.0 (compatible; LayerflowSiteCheck/1.0; +https://github.com/Rohit94r/KURUKSHETRA-IMPIC)";
const PAGE_MAX = 3 * 1024 * 1024;

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return privateV4(ip);
  const x = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  // NAT64 (64:ff9b::/96) wraps an ordinary IPv4 address — judge the address inside
  const nat64 = x.match(/^64:ff9b::(?:([0-9a-f]{1,4}):([0-9a-f]{1,4})|(\d+\.\d+\.\d+\.\d+))$/);
  if (nat64) {
    if (nat64[3]) return privateV4(nat64[3]);
    const hi = parseInt(nat64[1], 16);
    const lo = parseInt(nat64[2], 16);
    return privateV4([hi >> 8, hi & 255, lo >> 8, lo & 255].join("."));
  }
  return x === "::" || x === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("2001:db8:") || x.startsWith("100::");
}

const PRIVATE_MSG = "That address points inside a private network. Only public websites can be checked.";

async function resolvePublic(host: string): Promise<{ address: string; family: 4 | 6 }> {
  const h = host.replace(/^\[|\]$/g, "");
  if (net.isIP(h)) {
    if (isPrivateIp(h)) throw new SiteError(PRIVATE_MSG);
    return { address: h, family: net.isIP(h) as 4 | 6 };
  }
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/i.test(h)) throw new SiteError(PRIVATE_MSG);
  const all = await lookup(h, { all: true }).catch(() => []);
  if (!all.length) throw new SiteError(`Couldn't find ${h}. Check the address and try again.`);
  if (all.some((a) => isPrivateIp(a.address))) throw new SiteError(PRIVATE_MSG);
  const pick = all.find((a) => a.family === 4) ?? all[0];
  return { address: pick.address, family: pick.family as 4 | 6 };
}

/** Parses what the user typed: adds https:// when missing; refuses odd ports and credentials. */
export function normaliseUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new SiteError("Paste a website address, like https://example.com.");
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new SiteError("That doesn't look like a website address. Try something like https://example.com.");
  }
  if (!/^https?:$/.test(u.protocol)) throw new SiteError("Only http:// and https:// websites can be checked.");
  if (u.username || u.password) throw new SiteError("Remove the username / password from the address.");
  if (u.port && !["80", "443"].includes(u.port)) throw new SiteError("Only websites on the normal ports (80 and 443) can be checked.");
  if (!u.hostname.includes(".") && !net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) throw new SiteError("Use a full domain, like example.com.");
  u.hash = "";
  return u;
}

interface Got {
  status: number;
  headers: Record<string, string>;
  cookies: string[];
  location: string | null;
  body: Buffer;
  ttfb: number;
  total: number;
  truncated: boolean;
}

/** One request to one checked address. Never follows redirects itself. */
async function once(url: URL, opts: { method?: "GET" | "HEAD"; max: number; timeoutMs: number; accept?: string }): Promise<Got> {
  const addr = await resolvePublic(url.hostname);
  const mod = url.protocol === "https:" ? https : http;
  const t0 = performance.now();
  return new Promise<Got>((resolve, reject) => {
    const req = mod.request(
      {
        method: opts.method ?? "GET",
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: { "user-agent": UA, accept: opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "accept-encoding": "gzip, deflate, br", "accept-language": "en-IN,en;q=0.9" },
        // connect to the address we checked — and only that one
        lookup: ((_h: string, o: { all?: boolean }, cb: (...a: unknown[]) => void) => (o?.all ? cb(null, [{ address: addr.address, family: addr.family }]) : cb(null, addr.address, addr.family))) as unknown as net.LookupFunction,
        timeout: opts.timeoutMs,
      },
      (res) => {
        const ttfb = performance.now() - t0;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined && k !== "set-cookie") headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
        const cookies = (res.headers["set-cookie"] ?? []).map(String);
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (opts.method === "HEAD" || (status >= 300 && status < 400) || opts.max === 0) {
          res.resume();
          res.on("end", () => resolve({ status, headers, cookies, location, body: Buffer.alloc(0), ttfb, total: performance.now() - t0, truncated: false }));
          res.on("error", reject);
          return;
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream = enc.includes("br") ? res.pipe(zlib.createBrotliDecompress()) : enc.includes("gzip") ? res.pipe(zlib.createGunzip()) : enc.includes("deflate") ? res.pipe(zlib.createInflate()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        const finish = () => resolve({ status, headers, cookies, location, body: Buffer.concat(chunks), ttfb, total: performance.now() - t0, truncated });
        stream.on("data", (c: Buffer) => {
          if (truncated) return;
          size += c.length;
          if (size > opts.max) {
            chunks.push(c.subarray(0, Math.max(0, c.length - (size - opts.max))));
            truncated = true;
            res.destroy();
            finish();
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => !truncated && finish());
        stream.on("error", (e: Error) => (truncated ? undefined : chunks.length ? finish() : reject(e)));
      },
    );
    req.on("timeout", () => req.destroy(new SiteError(`${url.hostname} took too long to answer.`, 504)));
    req.on("error", (e) => reject(e instanceof SiteError ? e : new SiteError(`Couldn't connect to ${url.hostname} (${(e as NodeJS.ErrnoException).code ?? e.message}).`, 502)));
    req.end();
  });
}

/** Follows up to `hops` redirects, checking every hop. */
async function follow(start: URL, opts: { method?: "GET" | "HEAD"; max: number; timeoutMs: number; accept?: string }, hops = 5): Promise<{ got: Got; url: URL; chain: string[] }> {
  let url = start;
  const chain: string[] = [];
  for (let i = 0; i <= hops; i++) {
    const got = await once(url, opts);
    if (got.status >= 300 && got.status < 400 && got.location) {
      const next = new URL(got.location, url);
      if (!/^https?:$/.test(next.protocol) || (next.port && !["80", "443"].includes(next.port))) throw new SiteError("The site redirects somewhere we can't follow.");
      chain.push(url.toString());
      url = next;
      continue;
    }
    return { got, url, chain };
  }
  throw new SiteError("Too many redirects.");
}

async function quiet<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export async function fetchSite(input: string): Promise<SiteFetch> {
  const start = normaliseUrl(input);
  const page = await follow(start, { max: PAGE_MAX, timeoutMs: 12_000 });
  const ct = page.got.headers["content-type"] ?? "";
  if (ct && !/html|xml/i.test(ct)) throw new SiteError(`That address isn't a web page (it's ${ct.split(";")[0]}). Paste the site's home page or another page.`);
  const html = page.got.body.toString("utf8");
  if (!html.trim()) throw new SiteError(`${page.url.hostname} answered with an empty page (HTTP ${page.got.status}).`, 502);
  const origin = page.url.origin;

  const httpUpgrade = (async (): Promise<SiteFetch["http_upgrade"]> => {
    if (page.url.protocol !== "https:") return null;
    const r = await quiet(once(new URL(`http://${page.url.host}/`), { max: 0, timeoutMs: 5000 }));
    if (!r) return "unreachable";
    return r.status >= 300 && r.status < 400 && /^https:/i.test(r.location ?? "") ? "redirects" : "no-redirect";
  })();
  const robots = quiet(follow(new URL("/robots.txt", origin), { max: 100_000, timeoutMs: 5000, accept: "text/plain,*/*" }, 2)).then((r) => (r ? { status: r.got.status, text: /html/i.test(r.got.headers["content-type"] ?? "") ? "" : r.got.body.toString("utf8") } : null));
  const securityTxt = quiet(follow(new URL("/.well-known/security.txt", origin), { max: 4096, timeoutMs: 5000, accept: "text/plain,*/*" }, 2)).then((r) => (r ? (r.got.status === 200 && /html/i.test(r.got.headers["content-type"] ?? "") ? 404 : r.got.status) : null));
  const resources = pool(pickResources(html, page.url.toString()), 6, async (x): Promise<SiteResource> => {
    const r = await quiet(follow(new URL(x.url), { method: "HEAD", max: 0, timeoutMs: 6000, accept: x.type === "image" ? "image/avif,image/webp,image/*,*/*;q=0.8" : "*/*" }, 2));
    if (!r) return { url: x.url, type: x.type, status: 0, bytes: null, encoding: null, cache: null, content_type: null };
    const len = Number(r.got.headers["content-length"]);
    return { url: x.url, type: x.type, status: r.got.status, bytes: Number.isFinite(len) && len > 0 ? len : null, encoding: r.got.headers["content-encoding"] ?? null, cache: r.got.headers["cache-control"] ?? null, content_type: r.got.headers["content-type"] ?? null };
  });

  const robotsDone = await robots;
  const sitemapUrl = robotsDone?.text.match(/^\s*sitemap\s*:\s*(\S+)/im)?.[1] ?? `${origin}/sitemap.xml`;
  const sitemap = await quiet(
    (async () => {
      const u = new URL(sitemapUrl, origin);
      const r = await follow(u, { max: 2048, timeoutMs: 5000, accept: "application/xml,text/xml,*/*" }, 2);
      return { url: u.toString(), status: r.got.status === 200 && /html/i.test(r.got.headers["content-type"] ?? "") ? 404 : r.got.status };
    })(),
  );
  const res = await resources;
  // a public .map next to our own scripts rebuilds the original source code
  const ownScripts = res.filter((r) => r.type === "script" && r.status === 200 && new URL(r.url).host === page.url.host).slice(0, 3);
  const maps = await pool(ownScripts, 3, async (r) => {
    const u = `${r.url.split("?")[0]}.map`;
    const m = await quiet(once(new URL(u), { method: "HEAD", max: 0, timeoutMs: 5000, accept: "*/*" }));
    return { url: u, exposed: !!m && m.status === 200 && !/html/i.test(m.headers["content-type"] ?? "") };
  });

  return {
    input,
    url: page.url.toString(),
    status: page.got.status,
    redirects: page.chain,
    headers: page.got.headers,
    cookies: page.got.cookies,
    html,
    html_bytes: page.got.body.length,
    ttfb_ms: page.got.ttfb,
    total_ms: page.got.total,
    http_upgrade: await httpUpgrade,
    robots: robotsDone,
    sitemap,
    security_txt: await securityTxt,
    resources: res,
    source_maps: maps,
    truncated: page.got.truncated,
  };
}
