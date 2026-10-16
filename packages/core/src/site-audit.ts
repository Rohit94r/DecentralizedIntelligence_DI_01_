/**
 * Website Analyse — checks a live web page the way a careful reviewer would:
 * security (HTTPS, headers, cookies, mixed content, old libraries, leaked keys),
 * speed, search (SEO), accessibility and good practice — and names the
 * technologies it's built with. For companies without a public repo: paste a
 * URL instead of a GitHub link.
 *
 * Pure: the API fetches the page (safely, a handful of requests) and passes
 * what it saw. Every finding quotes the evidence — the header, the tag, the
 * file — so a student can check it themselves. Values that look like secrets
 * are never copied into the report.
 */

export type SiteCategory = "security" | "performance" | "seo" | "accessibility" | "best";
export type SiteSeverity = "high" | "medium" | "low";

export interface SiteResource {
  url: string;
  type: "script" | "style" | "image" | "font" | "other";
  status: number;
  bytes: number | null;
  encoding: string | null;
  cache: string | null;
  content_type: string | null;
}

/** Everything the fetcher saw. */
export interface SiteFetch {
  input: string;
  url: string;
  status: number;
  redirects: string[];
  headers: Record<string, string>;
  cookies: string[];
  html: string;
  html_bytes: number;
  ttfb_ms: number;
  total_ms: number;
  /** what http:// did: sent you to https, stayed on http, or couldn't be reached (null = not checked) */
  http_upgrade: "redirects" | "no-redirect" | "unreachable" | null;
  robots: { status: number; text: string } | null;
  sitemap: { url: string; status: number } | null;
  security_txt: number | null;
  resources: SiteResource[];
  source_maps: { url: string; exposed: boolean }[];
  truncated: boolean;
}

export interface SiteIssue {
  id: string;
  category: SiteCategory;
  severity: SiteSeverity;
  title: string;
  /** what we saw on this site */
  detail: string;
  why: string;
  fix: string;
  evidence: string[];
}

export interface SiteTech {
  name: string;
  kind: string;
  version: string | null;
  evidence: string;
}

export interface SiteReport {
  kind: "site";
  site: {
    input: string;
    url: string;
    host: string;
    title: string | null;
    description: string | null;
    favicon: string | null;
    image: string | null;
    lang: string | null;
    https: boolean;
    status: number;
    server: string | null;
    redirects: string[];
  };
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  summary: string;
  categories: { id: SiteCategory; label: string; score: number; passed: number; total: number }[];
  tech: SiteTech[];
  issues: SiteIssue[];
  passed: { category: SiteCategory; title: string }[];
  metrics: {
    html_kb: number;
    ttfb_ms: number;
    total_ms: number;
    scripts: number;
    external_scripts: number;
    styles: number;
    images: number;
    links: number;
    tags: number;
    third_party: string[];
    sampled: number;
    sampled_kb: number;
    inline_script_kb: number;
  };
  review?: string;
  truncated: boolean;
}

export const SITE_CATEGORY_LABEL: Record<SiteCategory, string> = {
  security: "Security",
  performance: "Speed",
  seo: "Search (SEO)",
  accessibility: "Accessibility",
  best: "Good practice",
};

/* ───────────────────────── a small, forgiving HTML reader ───────────────────────── */

interface Tag {
  name: string;
  attrs: Record<string, string>;
  index: number;
  raw: string;
}

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR_RE)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))));
}

const textOf = (inner: string) =>
  decode(inner.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

interface Doc {
  scan: string;
  tags: Tag[];
  byName: (n: string) => Tag[];
  scripts: { attrs: Record<string, string>; body: string }[];
  styles: string[];
  elements: (name: string) => { attrs: Record<string, string>; inner: string; raw: string }[];
  head: string;
}

function readHtml(html: string): Doc {
  const clean = html.slice(0, 1_500_000).replace(/<!--[\s\S]*?-->/g, "");
  const scripts: Doc["scripts"] = [];
  const styles: string[] = [];
  for (const m of clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) scripts.push({ attrs: parseAttrs(m[1]), body: m[2] });
  for (const m of clean.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) styles.push(m[1]);
  // tags without the bodies of script / style / template / noscript, so their text never looks like markup
  const scan = clean.replace(/<(script|style|template|noscript)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi, (_m, t: string, a: string) => `<${t}${a}></${t}>`);
  const tags: Tag[] = [];
  for (const m of scan.matchAll(TAG_RE)) tags.push({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2] ?? ""), index: m.index ?? 0, raw: m[0] });
  const groups = new Map<string, Tag[]>();
  for (const t of tags) {
    const g = groups.get(t.name);
    if (g) g.push(t);
    else groups.set(t.name, [t]);
  }
  const headEnd = scan.search(/<\/head\s*>|<body\b/i);
  return {
    scan,
    tags,
    byName: (n) => groups.get(n) ?? [],
    scripts,
    styles,
    elements: (name) => [...scan.matchAll(new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, "gi"))].map((m) => ({ attrs: parseAttrs(m[1]), inner: m[2], raw: m[0] })),
    head: headEnd > 0 ? scan.slice(0, headEnd) : scan.slice(0, 20_000),
  };
}

/* ───────────────────────── helpers ───────────────────────── */

function abs(u: string | undefined, base: string): string | null {
  if (!u) return null;
  try {
    return new URL(u.trim(), base).toString();
  } catch {
    return null;
  }
}

const TWO_PART_TLD = /\.(co|com|org|net|ac|gov|edu|gen|firm|ind|nic|res)\.(in|uk|au|jp|nz|za|br|sg|my|id|pk|bd|lk|np)$/i;

export function siteOf(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(h) || h.includes(":")) return h;
  const parts = h.split(".");
  return parts.slice(TWO_PART_TLD.test(h) ? -3 : -2).join(".");
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
};

export function cmpVersion(a: string, b: string): number {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0);
  const y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const kb = (n: number) => Math.round((n / 1024) * 10) / 10;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A tag as a short, readable line of evidence (long attribute values cut). */
function showTag(t: Tag): string {
  return clip(t.raw.replace(/\s+/g, " "), 150);
}

/** Never put a secret-looking value in the report: keep the first 4 characters only. */
function mask(v: string): string {
  return v.length <= 6 ? "••••" : `${v.slice(0, 4)}${"•".repeat(Math.min(12, v.length - 4))}`;
}

const SECRET_RES: { name: string; re: RegExp }[] = [
  { name: "AWS access key", re: /\b(AKIA[0-9A-Z]{16})\b/ },
  { name: "Stripe secret key", re: /\b(sk_live_[0-9a-zA-Z]{20,})\b/ },
  { name: "Razorpay secret", re: /key_secret["']?\s*[:=]\s*["']([A-Za-z0-9]{16,})["']/ },
  { name: "Private key", re: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/ },
  { name: "GitHub token", re: /\b(gh[pousr]_[A-Za-z0-9]{36,})\b/ },
  { name: "Slack token", re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
  { name: "OpenAI key", re: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b/ },
  { name: "SendGrid key", re: /\b(SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b/ },
];

/* ───────────────────────── technology detection ───────────────────────── */

interface Seen {
  f: SiteFetch;
  doc: Doc;
  srcs: string[];
  links: string[];
  all: string;
  header: (k: string) => string;
  generator: string;
}

function ver(srcs: string[], res: RegExp[]): string | null {
  for (const s of srcs)
    for (const re of res) {
      const m = s.match(re);
      if (m?.[1]) return m[1];
    }
  return null;
}

const TECH: { name: string; kind: string; find: (s: Seen) => string | null; version?: (s: Seen) => string | null }[] = [
  { name: "Next.js", kind: "Web framework", find: (s) => (/\/_next\/static\//.test(s.all) ? "files under /_next/static/" : /__NEXT_DATA__/.test(s.f.html) ? "__NEXT_DATA__ script" : /next\.js/i.test(s.header("x-powered-by")) ? `x-powered-by: ${s.header("x-powered-by")}` : null) },
  { name: "Nuxt", kind: "Web framework", find: (s) => (/\/_nuxt\//.test(s.all) ? "files under /_nuxt/" : /window\.__NUXT__/.test(s.f.html) ? "window.__NUXT__" : null) },
  { name: "Gatsby", kind: "Web framework", find: (s) => (/id="___gatsby"/.test(s.f.html) ? 'div id="___gatsby"' : null) },
  { name: "Remix", kind: "Web framework", find: (s) => (/__remixContext/.test(s.f.html) ? "window.__remixContext" : null) },
  { name: "Astro", kind: "Web framework", find: (s) => (/<astro-island\b|\/_astro\//.test(s.f.html) ? "astro-island / /_astro/ files" : null) },
  { name: "Svelte", kind: "UI framework", find: (s) => (/__sveltekit|\/_app\/immutable\//.test(s.f.html) ? "SvelteKit app files" : /class="[^"]*\bsvelte-[a-z0-9]{5,}/.test(s.f.html) ? "svelte-xxxx classes" : null) },
  { name: "Angular", kind: "UI framework", find: (s) => (/\bng-version="/.test(s.f.html) ? "ng-version attribute" : null), version: (s) => s.f.html.match(/\bng-version="([\d.]+)"/)?.[1] ?? null },
  { name: "AngularJS", kind: "UI framework", find: (s) => (s.srcs.some((x) => /angular(?:js)?[/@.-]1\.|angular(\.min)?\.js/i.test(x)) && !/ng-version=/.test(s.f.html) ? "angular.js script" : null), version: (s) => ver(s.srcs, [/angular(?:\.js)?\/(1\.\d+\.\d+)\//i, /angular@(1\.\d+\.\d+)/i]) },
  { name: "Vue", kind: "UI framework", find: (s) => (/\sdata-v-[0-9a-f]{6,8}\b/.test(s.f.html) ? "data-v-xxxx attributes" : s.srcs.some((x) => /\/vue(@|\/|\.)[\d.]*.*\.js/i.test(x)) ? "vue script" : null), version: (s) => ver(s.srcs, [/vue@(\d+\.\d+\.\d+)/i, /vue\/(\d+\.\d+\.\d+)\//i]) },
  { name: "React", kind: "UI library", find: (s) => (/\/_next\/static\//.test(s.all) || /__NEXT_DATA__|__remixContext|id="___gatsby"/.test(s.f.html) ? "used by the framework above" : /data-reactroot|data-reactid/.test(s.f.html) ? "data-reactroot attribute" : s.srcs.some((x) => /react(-dom)?(@|\/|\.)[\d.]*.*\.js/i.test(x)) ? "react-dom script" : null), version: (s) => ver(s.srcs, [/react-dom@(\d+\.\d+\.\d+)/i, /react-dom\/(\d+\.\d+\.\d+)\//i]) },
  { name: "Preact", kind: "UI library", find: (s) => (s.srcs.some((x) => /preact/i.test(x)) ? "preact script" : null) },
  { name: "Alpine.js", kind: "JavaScript library", find: (s) => (/\sx-data(=|\s|>)/.test(s.f.html) ? "x-data attributes" : null) },
  { name: "htmx", kind: "JavaScript library", find: (s) => (/\shx-(get|post|put|delete|patch)=/.test(s.f.html) ? "hx-get / hx-post attributes" : null) },
  { name: "jQuery", kind: "JavaScript library", find: (s) => (s.srcs.some((x) => /jquery/i.test(x) && !/jquery[-.]?ui|jquery\.(migrate|validate|cookie|form)/i.test(x)) ? s.srcs.find((x) => /jquery/i.test(x))!.split("?")[0].split("/").slice(-2).join("/") : null), version: (s) => jqueryVersion(s.srcs) },
  { name: "Bootstrap", kind: "CSS framework", find: (s) => ([...s.srcs, ...s.links].some((x) => /bootstrap/i.test(x)) ? "bootstrap CSS / JS" : null), version: (s) => ver([...s.srcs, ...s.links], [/bootstrap@(\d+\.\d+\.\d+)/i, /bootstrap\/(\d+\.\d+\.\d+)\//i, /bootstrap[-.](\d+\.\d+\.\d+)/i]) },
  { name: "Tailwind CSS", kind: "CSS framework", find: (s) => (/--tw-[a-z-]+\s*:/.test(s.doc.styles.join("\n")) || s.links.some((x) => /tailwind/i.test(x)) ? "--tw-* variables" : null) },
  { name: "Lodash", kind: "JavaScript library", find: (s) => (s.srcs.some((x) => /lodash/i.test(x)) ? "lodash script" : null), version: (s) => ver(s.srcs, [/lodash@(\d+\.\d+\.\d+)/i, /lodash(?:\.js)?\/(\d+\.\d+\.\d+)\//i]) },
  { name: "GSAP", kind: "JavaScript library", find: (s) => (s.srcs.some((x) => /gsap|greensock|TweenMax/i.test(x)) ? "GSAP script" : null) },
  { name: "Three.js", kind: "JavaScript library", find: (s) => (s.srcs.some((x) => /three(\.min)?\.js|\/three@/i.test(x)) ? "three.js script" : null) },
  { name: "D3", kind: "JavaScript library", find: (s) => (s.srcs.some((x) => /\/d3(@|\.v\d|\.min)|d3js\.org/i.test(x)) ? "d3 script" : null) },
  { name: "Chart.js", kind: "JavaScript library", find: (s) => (s.srcs.some((x) => /chart(\.umd)?(\.min)?\.js|chart\.js@/i.test(x)) ? "chart.js script" : null) },
  { name: "WordPress", kind: "CMS", find: (s) => (/\/wp-content\/|\/wp-includes\//.test(s.all) ? "files under /wp-content/" : /wordpress/i.test(s.generator) ? `generator: ${s.generator}` : null), version: (s) => s.generator.match(/WordPress\s+([\d.]+)/i)?.[1] ?? null },
  { name: "WooCommerce", kind: "E-commerce", find: (s) => (/woocommerce/i.test(s.all) ? "woocommerce files / classes" : null) },
  { name: "Elementor", kind: "Site builder", find: (s) => (/elementor/i.test(s.all) ? "elementor files / classes" : null) },
  { name: "Shopify", kind: "E-commerce", find: (s) => (/cdn\.shopify\.com|Shopify\.theme/.test(s.f.html) || s.header("x-shopid") ? "cdn.shopify.com assets" : null) },
  { name: "Wix", kind: "Site builder", find: (s) => (/static\.wixstatic\.com|wix\.com Website Builder/i.test(s.f.html) || s.header("x-wix-request-id") ? "Wix assets" : null) },
  { name: "Webflow", kind: "Site builder", find: (s) => (/data-wf-page=|webflow\.js|assets\.website-files\.com|cdn\.prod\.website-files\.com/.test(s.f.html) ? "Webflow assets" : null) },
  { name: "Squarespace", kind: "Site builder", find: (s) => (/static1\.squarespace\.com|squarespace-cdn/.test(s.f.html) ? "Squarespace assets" : null) },
  { name: "Ghost", kind: "CMS", find: (s) => (/^ghost/i.test(s.generator) ? `generator: ${s.generator}` : null) },
  { name: "Drupal", kind: "CMS", find: (s) => (/drupal/i.test(s.generator) || /Drupal\.settings|\/sites\/default\/files\//.test(s.f.html) ? "Drupal files" : null) },
  { name: "Joomla", kind: "CMS", find: (s) => (/joomla/i.test(s.generator) ? `generator: ${s.generator}` : null) },
  { name: "Hugo", kind: "Static site generator", find: (s) => (/^hugo/i.test(s.generator) ? `generator: ${s.generator}` : null) },
  { name: "Jekyll", kind: "Static site generator", find: (s) => (/jekyll/i.test(s.generator) ? `generator: ${s.generator}` : null) },
  { name: "Docusaurus", kind: "Static site generator", find: (s) => (/docusaurus/i.test(s.generator) ? `generator: ${s.generator}` : null) },
  { name: "VitePress", kind: "Static site generator", find: (s) => (/vitepress/i.test(s.generator) ? `generator: ${s.generator}` : null) },
  { name: "Google Analytics", kind: "Analytics", find: (s) => (s.srcs.some((x) => /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(analytics|ga)\.js/.test(x)) ? "gtag.js / analytics.js" : null) },
  { name: "Google Tag Manager", kind: "Tag manager", find: (s) => (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(s.f.html) ? "gtm.js" : null) },
  { name: "Hotjar", kind: "Analytics", find: (s) => (/static\.hotjar\.com|hotjar/i.test(s.f.html) ? "Hotjar script" : null) },
  { name: "Mixpanel", kind: "Analytics", find: (s) => (/cdn\.mxpnl\.com|mixpanel/i.test(s.f.html) ? "Mixpanel script" : null) },
  { name: "Sentry", kind: "Error tracking", find: (s) => (/browser\.sentry-cdn\.com|sentry\.io|Sentry\.init/.test(s.f.html) ? "Sentry SDK" : null) },
  { name: "Intercom", kind: "Chat & support", find: (s) => (/widget\.intercom\.io|intercomSettings/.test(s.f.html) ? "Intercom widget" : null) },
  { name: "HubSpot", kind: "Marketing", find: (s) => (/js\.hs-scripts\.com|js\.hsforms\.net/.test(s.f.html) ? "HubSpot script" : null) },
  { name: "Zendesk", kind: "Chat & support", find: (s) => (/static\.zdassets\.com/.test(s.f.html) ? "Zendesk widget" : null) },
  { name: "Stripe", kind: "Payments", find: (s) => (/js\.stripe\.com/.test(s.f.html) ? "js.stripe.com" : null) },
  { name: "Razorpay", kind: "Payments", find: (s) => (/checkout\.razorpay\.com/.test(s.f.html) ? "checkout.razorpay.com" : null) },
  { name: "Google Fonts", kind: "Fonts", find: (s) => (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(s.f.html) ? "fonts.googleapis.com" : null) },
  { name: "Font Awesome", kind: "Icons", find: (s) => (/font-?awesome|kit\.fontawesome\.com/i.test(s.f.html) ? "Font Awesome CSS / kit" : null) },
  { name: "YouTube", kind: "Video", find: (s) => (/youtube(-nocookie)?\.com\/embed\//.test(s.f.html) ? "YouTube embed" : null) },
  { name: "Vimeo", kind: "Video", find: (s) => (/player\.vimeo\.com/.test(s.f.html) ? "Vimeo embed" : null) },
  { name: "Google Maps", kind: "Maps", find: (s) => (/maps\.googleapis\.com|google\.com\/maps\/embed/.test(s.f.html) ? "Google Maps embed" : null) },
  { name: "Mapbox", kind: "Maps", find: (s) => (/api\.mapbox\.com|mapbox-gl/.test(s.f.html) ? "Mapbox GL" : null) },
  { name: "Leaflet", kind: "Maps", find: (s) => (/leaflet(\.min)?\.(js|css)/.test(s.f.html) ? "Leaflet" : null) },
  { name: "jsDelivr", kind: "CDN", find: (s) => (s.srcs.some((x) => /cdn\.jsdelivr\.net/.test(x)) ? "cdn.jsdelivr.net" : null) },
  { name: "unpkg", kind: "CDN", find: (s) => (s.srcs.some((x) => /unpkg\.com/.test(x)) ? "unpkg.com" : null) },
  // hosting, servers and languages — from response headers
  { name: "Cloudflare", kind: "Hosting / CDN", find: (s) => (s.header("cf-ray") ? "cf-ray header" : /cloudflare/i.test(s.header("server")) ? "server: cloudflare" : null) },
  { name: "Vercel", kind: "Hosting / CDN", find: (s) => (s.header("x-vercel-id") ? "x-vercel-id header" : /vercel/i.test(s.header("server")) ? "server: Vercel" : null) },
  { name: "Netlify", kind: "Hosting / CDN", find: (s) => (s.header("x-nf-request-id") ? "x-nf-request-id header" : /netlify/i.test(s.header("server")) ? "server: Netlify" : null) },
  { name: "GitHub Pages", kind: "Hosting / CDN", find: (s) => (/github\.com/i.test(s.header("server")) && !/(^|\.)github\.com$/i.test(hostOf(s.f.url)) ? "server: GitHub.com" : null) },
  { name: "Fastly", kind: "Hosting / CDN", find: (s) => (/fastly/i.test(s.header("x-served-by") + s.header("via")) || s.header("x-fastly-request-id") ? "Fastly headers" : null) },
  { name: "Akamai", kind: "Hosting / CDN", find: (s) => (/akamai/i.test(s.header("server") + s.header("x-akamai-transformed")) ? "Akamai headers" : null) },
  { name: "Amazon CloudFront", kind: "Hosting / CDN", find: (s) => (s.header("x-amz-cf-id") ? "x-amz-cf-id header" : null) },
  { name: "Google Cloud", kind: "Hosting / CDN", find: (s) => (/google frontend|gws|gse/i.test(s.header("server")) ? `server: ${s.header("server")}` : null) },
  { name: "nginx", kind: "Web server", find: (s) => (/nginx/i.test(s.header("server")) ? `server: ${s.header("server")}` : null), version: (s) => s.header("server").match(/nginx\/([\d.]+)/i)?.[1] ?? null },
  { name: "Apache", kind: "Web server", find: (s) => (/apache/i.test(s.header("server")) ? `server: ${s.header("server")}` : null), version: (s) => s.header("server").match(/apache\/([\d.]+)/i)?.[1] ?? null },
  { name: "PHP", kind: "Server language", find: (s) => (/php/i.test(s.header("x-powered-by")) ? `x-powered-by: ${s.header("x-powered-by")}` : s.f.cookies.some((c) => /^PHPSESSID=/i.test(c)) ? "PHPSESSID cookie" : null), version: (s) => s.header("x-powered-by").match(/php\/([\d.]+)/i)?.[1] ?? null },
  { name: "Express", kind: "Web server", find: (s) => (/express/i.test(s.header("x-powered-by")) ? "x-powered-by: Express" : null) },
  { name: ".NET", kind: "Server language", find: (s) => (/asp\.net/i.test(s.header("x-powered-by")) || s.header("x-aspnet-version") ? "ASP.NET headers" : null) },
];

function jqueryVersion(srcs: string[]): string | null {
  for (const s of srcs) {
    if (!/jquery/i.test(s) || /jquery[-.]?ui|migrate/i.test(s)) continue;
    const m = s.match(/jquery[-.]?(\d+\.\d+\.\d+)/i) ?? s.match(/jquery@(\d+\.\d+\.\d+)/i) ?? s.match(/jquery\/(\d+\.\d+\.\d+)\//i) ?? (/wp-includes\/js\/jquery\//.test(s) ? s.match(/[?&]ver=(\d+\.\d+\.\d+)/) : null);
    if (m) return m[1];
  }
  return null;
}

/* ───────────────────────── the checks ───────────────────────── */

interface Ctx extends Seen {
  https: boolean;
  firstParty: string;
  ext: (u: string) => boolean;
  tech: SiteTech[];
}

type Result = null | "skip" | { detail: string; evidence?: string[]; severity?: SiteSeverity; title?: string };

interface Check {
  id: string;
  category: SiteCategory;
  severity: SiteSeverity;
  title: string;
  pass: string;
  why: string;
  fix: string;
  run: (c: Ctx) => Result;
}

const COOKIE_SESSIONISH = /sess|sid|auth|token|login|jwt|remember|user/i;

const CHECKS: Check[] = [
  /* ── security ── */
  {
    id: "https",
    category: "security",
    severity: "high",
    title: "The site doesn't use HTTPS",
    pass: "Served over HTTPS",
    why: "Without HTTPS, anyone on the same Wi-Fi or network can read and change what visitors send and see — passwords, forms, even the page itself.",
    fix: "Turn on HTTPS (free with Let's Encrypt, or automatic on Vercel, Netlify and Cloudflare) and send every http:// request to https://.",
    run: (c) => (c.https ? null : { detail: `The final address is ${c.f.url}.`, evidence: [c.f.url] }),
  },
  {
    id: "http-redirect",
    category: "security",
    severity: "medium",
    title: "http:// doesn't redirect to https://",
    pass: "http:// redirects to https://",
    why: "People still type the bare address or follow old links. If http:// doesn't forward them to https://, that first visit is unprotected.",
    fix: "Add a permanent (301) redirect from http:// to https:// in your host, CDN or web server.",
    run: (c) => (!c.https || c.f.http_upgrade === null || c.f.http_upgrade === "unreachable" ? "skip" : c.f.http_upgrade === "redirects" ? null : { detail: `http://${hostOf(c.f.url)}/ answered without sending visitors to https.` }),
  },
  {
    id: "hsts",
    category: "security",
    severity: "medium",
    title: "No Strict-Transport-Security (HSTS) header",
    pass: "HSTS is on",
    why: "HSTS tells the browser to always use HTTPS for this site, even if someone clicks an http:// link — it closes the gap that downgrade attacks use.",
    fix: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains once the whole site works on HTTPS.",
    run: (c) => {
      if (!c.https) return "skip";
      const v = c.header("strict-transport-security");
      if (!v) return { detail: "The response has no Strict-Transport-Security header." };
      const age = Number(v.match(/max-age=(\d+)/i)?.[1] ?? 0);
      return age < 15_552_000 ? { title: "HSTS is on, but only for a short time", detail: `max-age is only ${age} seconds (under 6 months).`, evidence: [`strict-transport-security: ${v}`], severity: "low" } : null;
    },
  },
  {
    id: "csp",
    category: "security",
    severity: "medium",
    title: "No Content-Security-Policy",
    pass: "Has a Content-Security-Policy",
    why: "A CSP lists where scripts may load from. If an attacker manages to inject a <script> (XSS), the browser refuses to run it — a strong second line of defence.",
    fix: "Start with Content-Security-Policy-Report-Only to see what would break, then enforce a policy such as default-src 'self'; script-src 'self' plus the CDNs you really use.",
    run: (c) => {
      const v = c.header("content-security-policy") || c.doc.byName("meta").find((m) => (m.attrs["http-equiv"] ?? "").toLowerCase() === "content-security-policy")?.attrs.content || "";
      if (!v) return { detail: "No Content-Security-Policy header or meta tag." };
      const script = v.match(/script-src[^;]*/i)?.[0] ?? v.match(/default-src[^;]*/i)?.[0] ?? "";
      return /'unsafe-inline'/.test(script) && !/'nonce-|'sha(256|384|512)-|'strict-dynamic'/.test(script) ? { title: "The Content-Security-Policy allows inline scripts", detail: "The policy allows 'unsafe-inline' scripts, so it can't stop injected inline code.", evidence: [clip(`content-security-policy: ${v}`, 180)], severity: "low" } : null;
    },
  },
  {
    id: "clickjacking",
    category: "security",
    severity: "medium",
    title: "The page can be framed by other sites (clickjacking)",
    pass: "Can't be framed by other sites",
    why: "Another site can load this page in an invisible frame and trick visitors into clicking buttons they can't see — like 'Delete account' or 'Pay'.",
    fix: "Send X-Frame-Options: DENY (or SAMEORIGIN), or Content-Security-Policy: frame-ancestors 'self'.",
    run: (c) => (c.header("x-frame-options") || /frame-ancestors/i.test(c.header("content-security-policy")) ? null : { detail: "Neither X-Frame-Options nor a CSP frame-ancestors rule is set." }),
  },
  {
    id: "nosniff",
    category: "security",
    severity: "low",
    title: "No X-Content-Type-Options: nosniff",
    pass: "X-Content-Type-Options: nosniff",
    why: "Without it, some browsers guess a file's type from its contents — an uploaded 'image' can end up being run as a script.",
    fix: "Send X-Content-Type-Options: nosniff on every response.",
    run: (c) => (/nosniff/i.test(c.header("x-content-type-options")) ? null : { detail: "The header is missing." }),
  },
  {
    id: "referrer",
    category: "security",
    severity: "low",
    title: "No Referrer-Policy",
    pass: "Has a Referrer-Policy",
    why: "When a visitor clicks an outside link, the full address of your page — including any ids or tokens in it — can be sent to the other site.",
    fix: "Send Referrer-Policy: strict-origin-when-cross-origin (or no-referrer).",
    run: (c) => (c.header("referrer-policy") || c.doc.byName("meta").some((m) => (m.attrs.name ?? "").toLowerCase() === "referrer") ? null : { detail: "No Referrer-Policy header or meta tag." }),
  },
  {
    id: "permissions",
    category: "security",
    severity: "low",
    title: "No Permissions-Policy",
    pass: "Has a Permissions-Policy",
    why: "It switches off powerful browser features the site doesn't need (camera, microphone, location), so an injected script can't use them either.",
    fix: "Send Permissions-Policy: camera=(), microphone=(), geolocation=() — and allow only what you use.",
    run: (c) => (c.header("permissions-policy") || c.header("feature-policy") ? null : { detail: "The header is missing." }),
  },
  {
    id: "server-version",
    category: "security",
    severity: "low",
    title: "The server tells everyone its exact software version",
    pass: "Server versions are hidden",
    why: "A header like 'Apache/2.4.41' or 'PHP/7.4.3' lets an attacker look up known holes for that exact version without any effort.",
    fix: "Hide versions: server_tokens off (nginx), ServerTokens Prod (Apache), expose_php = Off (PHP), app.disable('x-powered-by') (Express).",
    run: (c) => {
      const ev = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"].filter((k) => /\d+\.\d+/.test(c.header(k)) || (k === "x-powered-by" && c.header(k))).map((k) => `${k}: ${c.header(k)}`);
      return ev.length ? { detail: `Found ${plural(ev.length, "header")} that name the software${ev.some((e) => /\d+\.\d+/.test(e)) ? " and its version" : ""}.`, evidence: ev } : null;
    },
  },
  {
    id: "cookies",
    category: "security",
    severity: "medium",
    title: "Cookies are missing Secure / HttpOnly / SameSite",
    pass: "Cookies are set safely",
    why: "A login cookie without HttpOnly can be stolen by any injected script; without Secure it can travel over plain http; without SameSite other sites can make requests that carry it (CSRF).",
    fix: "Set session cookies with Secure; HttpOnly; SameSite=Lax (or Strict).",
    run: (c) => {
      if (!c.f.cookies.length) return "skip";
      const bad = c.f.cookies
        .map((ck) => {
          const name = ck.split("=")[0].trim();
          const low = ck.toLowerCase();
          const miss = [!/;\s*secure/.test(low) && c.https && "Secure", !/;\s*httponly/.test(low) && COOKIE_SESSIONISH.test(name) && "HttpOnly", !/;\s*samesite=/.test(low) && "SameSite"].filter(Boolean) as string[];
          return miss.length ? { name, miss, session: COOKIE_SESSIONISH.test(name) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
      if (!bad.length) return null;
      return { detail: `${plural(bad.length, "cookie")} set without some protections.`, evidence: bad.slice(0, 4).map((b) => `${b.name} — missing ${b.miss.join(", ")}`), severity: bad.some((b) => b.session && b.miss.includes("HttpOnly")) ? "medium" : "low" };
    },
  },
  {
    id: "mixed-content",
    category: "security",
    severity: "high",
    title: "Mixed content: files loaded over http:// on an https page",
    pass: "No mixed content",
    why: "A script or stylesheet loaded over http:// can be swapped by anyone on the network — then they control the whole page. Browsers block some of it, which also breaks the page.",
    fix: "Load every script, style, image and frame over https:// (or use protocol-relative paths to your own files).",
    run: (c) => {
      if (!c.https) return "skip";
      const hits: { tag: Tag; active: boolean }[] = [];
      for (const t of c.doc.tags) {
        const u = t.name === "link" ? (/stylesheet|preload|modulepreload|icon/i.test(t.attrs.rel ?? "") ? t.attrs.href : undefined) : ["script", "img", "iframe", "source", "video", "audio", "embed"].includes(t.name) ? t.attrs.src : undefined;
        if (u && /^http:\/\//i.test(u.trim())) hits.push({ tag: t, active: ["script", "iframe", "link", "embed"].includes(t.name) });
      }
      if (!hits.length) return null;
      const active = hits.some((h) => h.active);
      return { detail: `${plural(hits.length, "file")} loaded over http://${active ? ", including scripts or styles" : " (images or media)"}.`, evidence: hits.slice(0, 3).map((h) => showTag(h.tag)), severity: active ? "high" : "medium" };
    },
  },
  {
    id: "insecure-form",
    category: "security",
    severity: "high",
    title: "A form sends data insecurely",
    pass: "Forms send data safely",
    why: "A form that posts to an http:// address sends what people type in plain text, and a password form using GET puts the password in the URL — browser history, server logs, and the Referer header.",
    fix: "Point every form action at https://, and use method=\"post\" for anything with a password.",
    run: (c) => {
      const bad: string[] = [];
      for (const f of c.doc.elements("form")) {
        const action = f.attrs.action ?? "";
        const method = (f.attrs.method ?? "get").toLowerCase();
        if (/^http:\/\//i.test(action)) bad.push(`<form action="${clip(action, 80)}">`);
        else if (method === "get" && /type\s*=\s*["']?password/i.test(f.inner)) bad.push(`<form method="get"> with a password field`);
      }
      return bad.length ? { detail: `${plural(bad.length, "form")} with a problem.`, evidence: bad.slice(0, 3) } : null;
    },
  },
  {
    id: "old-libraries",
    category: "security",
    severity: "medium",
    title: "Uses a JavaScript library with known security holes",
    pass: "No known-vulnerable library versions spotted",
    why: "Old library versions have public security bugs with ready-made exploits. Attackers scan the web for exactly these version numbers.",
    fix: "Update the library (jQuery ≥ 3.5.0, Bootstrap ≥ 3.4.1 / 4.3.1, Lodash ≥ 4.17.21) — or move off AngularJS, which stopped getting security fixes at the end of 2021.",
    run: (c) => {
      const bad: string[] = [];
      for (const t of c.tech) {
        if (t.name === "jQuery" && t.version && cmpVersion(t.version, "3.5.0") < 0) bad.push(`jQuery ${t.version} — XSS in htmlPrefilter (CVE-2020-11022, CVE-2020-11023), fixed in 3.5.0`);
        if (t.name === "Bootstrap" && t.version && (cmpVersion(t.version, "3.4.1") < 0 || (t.version.startsWith("4.") && cmpVersion(t.version, "4.3.1") < 0))) bad.push(`Bootstrap ${t.version} — XSS in tooltip / popover data-template (CVE-2019-8331), fixed in 3.4.1 / 4.3.1`);
        if (t.name === "Lodash" && t.version && cmpVersion(t.version, "4.17.21") < 0) bad.push(`Lodash ${t.version} — command injection in template (CVE-2021-23337), fixed in 4.17.21`);
        if (t.name === "AngularJS") bad.push(`AngularJS${t.version ? ` ${t.version}` : ""} — end of life since December 2021, no more security fixes`);
      }
      return bad.length ? { detail: `${plural(bad.length, "library", "libraries")} with published security problems.`, evidence: bad } : null;
    },
  },
  {
    id: "sri",
    category: "security",
    severity: "low",
    title: "Scripts from other sites load without an integrity check",
    pass: "Third-party scripts are pinned (or there are none)",
    why: "If that CDN is ever hacked, the script it serves changes — and runs on your site with full access. An integrity hash makes the browser refuse a changed file.",
    fix: 'Add integrity="sha384-…" crossorigin="anonymous" to <script> tags that load fixed versions from public CDNs (jsDelivr, unpkg, cdnjs show the hash).',
    run: (c) => {
      const cdn = c.doc.byName("script").filter((t) => t.attrs.src && /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|stackpath\.bootstrapcdn\.com|maxcdn\.bootstrapcdn\.com/i.test(t.attrs.src) && !t.attrs.integrity);
      return cdn.length ? { detail: `${plural(cdn.length, "script")} from public CDNs without integrity="…".`, evidence: cdn.slice(0, 3).map(showTag) } : c.doc.byName("script").some((t) => t.attrs.src && c.ext(t.attrs.src)) ? null : "skip";
    },
  },
  {
    id: "secrets",
    category: "security",
    severity: "high",
    title: "A secret key is visible in the page",
    pass: "No secret keys in the page source",
    why: "Anything in the HTML or inline scripts is public — anyone can press View Source. A secret API key there can be used to run up bills, read data or send messages as you.",
    fix: "Revoke the key now, issue a new one, and keep it on the server only (an environment variable read by your backend). Browsers should only ever see publishable keys.",
    run: (c) => {
      const found: string[] = [];
      const text = c.f.html.slice(0, 1_500_000);
      for (const s of SECRET_RES) {
        const m = text.match(s.re);
        if (m) found.push(`${s.name}: ${mask(m[1])}`);
      }
      return found.length ? { detail: `${plural(found.length, "secret-looking value")} in the page source (shown masked).`, evidence: found } : null;
    },
  },
  {
    id: "source-maps",
    category: "security",
    severity: "low",
    title: "Source maps are public",
    pass: "Source maps aren't exposed (in what we checked)",
    why: "A .map file rebuilds your original source code — comments, file names, sometimes hidden API routes — for anyone who asks for it.",
    fix: "Don't upload .map files to production, or block them (e.g. productionBrowserSourceMaps: false in Next.js, build.sourcemap: false in Vite).",
    run: (c) => {
      if (!c.f.source_maps.length) return "skip";
      const open = c.f.source_maps.filter((m) => m.exposed);
      return open.length ? { detail: `${plural(open.length, "source map")} can be downloaded.`, evidence: open.slice(0, 3).map((m) => m.url) } : null;
    },
  },
  {
    id: "noopener",
    category: "security",
    severity: "low",
    title: 'Links open new tabs without rel="noopener"',
    pass: "New-tab links are safe",
    why: 'A page opened with target="_blank" can reach back to your tab (window.opener) and swap it for a fake login page. Modern browsers block most of this; older ones don\'t.',
    fix: 'Add rel="noopener noreferrer" to every link with target="_blank".',
    run: (c) => {
      const bad = c.doc.byName("a").filter((a) => (a.attrs.target ?? "").toLowerCase() === "_blank" && !/noopener|noreferrer/i.test(a.attrs.rel ?? "") && c.ext(a.attrs.href ?? ""));
      return bad.length ? { detail: `${plural(bad.length, "external link")} with target="_blank" and no rel.`, evidence: bad.slice(0, 3).map(showTag) } : null;
    },
  },
  {
    id: "security-txt",
    category: "security",
    severity: "low",
    title: "No security.txt — researchers don't know where to report bugs",
    pass: "Has /.well-known/security.txt",
    why: "security.txt is a tiny file that tells security researchers (bug bounty hunters!) who to contact when they find a problem, instead of posting it publicly.",
    fix: "Create /.well-known/security.txt with a Contact: line (an email or a form) and an Expires: date — securitytxt.org writes it for you.",
    run: (c) => (c.f.security_txt === null ? "skip" : c.f.security_txt === 200 ? null : { detail: `/.well-known/security.txt answered ${c.f.security_txt}.` }),
  },

  /* ── speed ── */
  {
    id: "ttfb",
    category: "performance",
    severity: "medium",
    title: "The server is slow to answer",
    pass: "The server answers quickly",
    why: "Nothing appears until the first byte arrives. Over ~0.8 s feels sluggish, and Google uses speed when ranking pages.",
    fix: "Cache pages (a CDN, or static generation), speed up slow database queries, and host closer to your visitors.",
    run: (c) => (c.f.ttfb_ms <= 800 ? null : { detail: `First byte after ${(c.f.ttfb_ms / 1000).toFixed(2)} s (measured from Layerflow's server).`, severity: c.f.ttfb_ms > 1800 ? "high" : "medium" }),
  },
  {
    id: "compression",
    category: "performance",
    severity: "medium",
    title: "The page isn't compressed",
    pass: "The page is compressed (gzip / brotli)",
    why: "HTML compresses to about a quarter of its size. Without gzip or brotli every visitor downloads 3–4× more than needed — painful on mobile data.",
    fix: "Turn on gzip or brotli in your web server or CDN (most hosts have a single switch).",
    run: (c) => (c.f.html_bytes < 2048 ? "skip" : /gzip|br|zstd|deflate/i.test(c.header("content-encoding")) ? null : { detail: `${kb(c.f.html_bytes)} KB of HTML sent without content-encoding.` }),
  },
  {
    id: "html-size",
    category: "performance",
    severity: "medium",
    title: "The HTML is very large",
    pass: "The HTML is a sensible size",
    why: "A huge HTML file (often from big inline data or SVGs) delays everything else on the page, especially on phones.",
    fix: "Move large data to an API call, load long lists page by page, and put big inline SVGs or JSON in separate cached files.",
    run: (c) => (c.f.html_bytes <= 300 * 1024 ? null : { detail: `The HTML is ${kb(c.f.html_bytes)} KB.`, severity: c.f.html_bytes > 1024 * 1024 ? "high" : "medium" }),
  },
  {
    id: "render-blocking",
    category: "performance",
    severity: "medium",
    title: "Scripts in <head> block the page from showing",
    pass: "No render-blocking scripts in <head>",
    why: "A plain <script src> in the head stops the browser from drawing anything until that file has downloaded and run.",
    fix: 'Add defer (or async for independent scripts like analytics), or use type="module" — they don\'t block.',
    run: (c) => {
      const headEnd = c.doc.scan.search(/<\/head\s*>|<body\b/i);
      const bad = c.doc.byName("script").filter((t) => t.attrs.src && (headEnd < 0 || t.index < headEnd) && !("defer" in t.attrs) && !("async" in t.attrs) && !("nomodule" in t.attrs) && !/module/i.test(t.attrs.type ?? "") && !/json|template/i.test(t.attrs.type ?? ""));
      return bad.length ? { detail: `${plural(bad.length, "script")} in <head> without defer or async.`, evidence: bad.slice(0, 3).map(showTag), severity: bad.length >= 3 ? "medium" : "low" } : null;
    },
  },
  {
    id: "image-size",
    category: "performance",
    severity: "medium",
    title: "Large images",
    pass: "Images we checked are a sensible size",
    why: "Images are usually the heaviest part of a page. A 1 MB photo shown as a small card wastes data and slows the page.",
    fix: "Resize images to the size they're shown at, serve WebP or AVIF, and use srcset so phones get smaller files.",
    run: (c) => {
      const imgs = c.f.resources.filter((r) => r.type === "image" && r.bytes !== null);
      if (!imgs.length) return "skip";
      const big = imgs.filter((r) => (r.bytes ?? 0) > 300 * 1024);
      return big.length ? { detail: `${plural(big.length, "image")} over 300 KB.`, evidence: big.slice(0, 3).map((r) => `${clip(r.url, 110)} — ${kb(r.bytes!)} KB`), severity: big.some((r) => (r.bytes ?? 0) > 1024 * 1024) ? "high" : "medium" } : null;
    },
  },
  {
    id: "image-format",
    category: "performance",
    severity: "low",
    title: "Images use older formats",
    pass: "Images use modern formats (or are small)",
    why: "WebP and AVIF are 25–50% smaller than JPEG or PNG at the same quality.",
    fix: "Convert large JPEG / PNG images to WebP or AVIF (your framework's image component or a CDN can do it automatically).",
    run: (c) => {
      const old = c.f.resources.filter((r) => r.type === "image" && (r.bytes ?? 0) > 100 * 1024 && /jpe?g|png|gif|bmp/i.test(r.content_type ?? r.url));
      return old.length ? { detail: `${plural(old.length, "large JPEG / PNG image")}.`, evidence: old.slice(0, 3).map((r) => `${clip(r.url, 110)} — ${kb(r.bytes!)} KB`) } : c.f.resources.some((r) => r.type === "image") ? null : "skip";
    },
  },
  {
    id: "image-dimensions",
    category: "performance",
    severity: "low",
    title: "Images without width and height (the page jumps while loading)",
    pass: "Images reserve their space",
    why: "Without width and height the browser doesn't know how much room an image needs, so text jumps down when it loads — Google calls this layout shift (CLS).",
    fix: "Give every <img> width and height attributes (CSS can still make it responsive), or use your framework's image component.",
    run: (c) => {
      const imgs = c.doc.byName("img").filter((t) => !/^data:/.test(t.attrs.src ?? ""));
      if (imgs.length < 2) return "skip";
      const bad = imgs.filter((t) => !(t.attrs.width && t.attrs.height) && !/aspect-ratio|width\s*:\s*\d|height\s*:\s*\d/.test(t.attrs.style ?? "") && !("fill" in t.attrs) && !/fill/.test(t.attrs["data-nimg"] ?? ""));
      return bad.length / imgs.length > 0.3 ? { detail: `${bad.length} of ${imgs.length} images have no width and height.`, evidence: bad.slice(0, 3).map(showTag) } : null;
    },
  },
  {
    id: "lazy-images",
    category: "performance",
    severity: "low",
    title: "Images aren't lazy-loaded",
    pass: "Images below the fold load lazily",
    why: 'Every image downloads straight away, even ones far down the page that people may never scroll to. loading="lazy" waits until they\'re needed.',
    fix: 'Add loading="lazy" to images that aren\'t in the first screen (keep the top banner image eager).',
    run: (c) => {
      const imgs = c.doc.byName("img");
      if (imgs.length < 6) return "skip";
      const lazy = imgs.filter((t) => (t.attrs.loading ?? "").toLowerCase() === "lazy" || "data-src" in t.attrs || "data-lazy-src" in t.attrs).length;
      return lazy >= Math.min(3, imgs.length - 3) ? null : { detail: `${imgs.length} images, ${lazy} of them lazy.` };
    },
  },
  {
    id: "caching",
    category: "performance",
    severity: "low",
    title: "Static files aren't cached",
    pass: "Static files are cached by the browser",
    why: "Without a cache header, returning visitors download the same scripts, styles and images again on every visit.",
    fix: "Serve files with a version or hash in the name and Cache-Control: public, max-age=31536000, immutable.",
    run: (c) => {
      const st = c.f.resources.filter((r) => (r.type === "script" || r.type === "style" || r.type === "font") && !c.ext(r.url) && r.status === 200);
      if (!st.length) return "skip";
      const bad = st.filter((r) => !/max-age=\d{3,}|s-maxage=\d{3,}|immutable/i.test(r.cache ?? "") && !/public,?\s*max-age=[1-9]/i.test(r.cache ?? ""));
      return bad.length ? { detail: `${bad.length} of ${st.length} files we checked have no long cache.`, evidence: bad.slice(0, 3).map((r) => `${clip(r.url, 100)} — cache-control: ${r.cache ?? "(none)"}`) } : null;
    },
  },
  {
    id: "asset-compression",
    category: "performance",
    severity: "low",
    title: "Scripts or styles aren't compressed",
    pass: "Scripts and styles are compressed",
    why: "JavaScript and CSS shrink to a quarter of their size with gzip or brotli.",
    fix: "Turn on gzip / brotli for .js and .css (and .svg, .json) in your server or CDN.",
    run: (c) => {
      const st = c.f.resources.filter((r) => (r.type === "script" || r.type === "style") && !c.ext(r.url) && r.status === 200 && (r.bytes ?? 0) > 4096);
      if (!st.length) return "skip";
      const bad = st.filter((r) => !/gzip|br|zstd|deflate/i.test(r.encoding ?? ""));
      return bad.length ? { detail: `${bad.length} of ${st.length} files sent without compression.`, evidence: bad.slice(0, 3).map((r) => `${clip(r.url, 110)} — ${kb(r.bytes!)} KB`) } : null;
    },
  },
  {
    id: "js-weight",
    category: "performance",
    severity: "medium",
    title: "A lot of JavaScript",
    pass: "JavaScript weight looks reasonable",
    why: "Every kilobyte of JavaScript has to be downloaded, parsed and run — on a mid-range phone, 1 MB of JS can take several seconds before the page responds.",
    fix: "Split code per page, lazy-load heavy widgets, drop libraries you barely use, and check with your bundler's analyser.",
    run: (c) => {
      const js = c.f.resources.filter((r) => r.type === "script" && r.bytes !== null);
      const scripts = c.doc.byName("script").filter((t) => t.attrs.src).length;
      if (!js.length && scripts < 30) return "skip";
      const total = js.reduce((n, r) => n + (r.bytes ?? 0), 0);
      if (total > 1024 * 1024) return { detail: `The ${js.length} scripts we measured add up to ${kb(total)} KB${js.length < scripts ? ` (and there are ${scripts - js.length} more)` : ""}.` };
      if (scripts > 30) return { detail: `${scripts} separate script files.`, severity: "low" };
      return null;
    },
  },
  {
    id: "font-display",
    category: "performance",
    severity: "low",
    title: "Web fonts may hide text while loading",
    pass: "Fonts show text while they load",
    why: "Without font-display: swap, text can stay invisible for up to 3 seconds while the custom font downloads.",
    fix: "Add &display=swap to the Google Fonts URL, or font-display: swap to your @font-face rules.",
    run: (c) => {
      const gf = c.doc.byName("link").filter((t) => /fonts\.googleapis\.com\/css/i.test(t.attrs.href ?? ""));
      if (!gf.length) return "skip";
      const bad = gf.filter((t) => !/display=(swap|optional|fallback)/i.test(t.attrs.href ?? ""));
      return bad.length ? { detail: "Google Fonts is loaded without display=swap.", evidence: bad.slice(0, 2).map(showTag) } : null;
    },
  },
  {
    id: "third-parties",
    category: "performance",
    severity: "low",
    title: "Many third-party services",
    pass: "A modest number of third-party services",
    why: "Each outside domain costs a new connection, and every tracker or widget adds JavaScript you don't control.",
    fix: "Remove tags you no longer use, load widgets (chat, video) only when needed, and self-host fonts.",
    run: (c) => {
      const n = thirdParties(c).length;
      return n > 10 ? { detail: `Loads from ${n} other domains.`, evidence: [thirdParties(c).slice(0, 10).join(", ")] } : null;
    },
  },
  {
    id: "dom-size",
    category: "performance",
    severity: "low",
    title: "A very large page (lots of HTML elements)",
    pass: "The page has a manageable number of elements",
    why: "Thousands of elements use more memory and make every style change and scroll slower, especially on phones.",
    fix: "Paginate or virtualise long lists, and remove hidden duplicates (e.g. a separate mobile copy of the whole menu).",
    run: (c) => (c.doc.tags.length > 3000 ? { detail: `About ${c.doc.tags.length.toLocaleString("en-IN")} elements.` } : null),
  },

  /* ── search (SEO) ── */
  {
    id: "status",
    category: "seo",
    severity: "high",
    title: "The page answers with an error status",
    pass: "Answers 200 OK",
    why: "Search engines won't index a page that answers with an error — and visitors see a broken page.",
    fix: "Check the server logs for why this address fails, and make sure the main URL answers 200.",
    run: (c) => (c.f.status >= 200 && c.f.status < 300 ? null : { detail: `HTTP ${c.f.status}.` }),
  },
  {
    id: "noindex",
    category: "seo",
    severity: "high",
    title: "The page tells search engines not to list it",
    pass: "Search engines may list the page",
    why: "A noindex rule hides the page from Google completely. It's often left over from a staging site.",
    fix: 'Remove <meta name="robots" content="noindex"> (or the X-Robots-Tag header) from pages you want people to find.',
    run: (c) => {
      const meta = c.doc.byName("meta").find((m) => /^(robots|googlebot)$/i.test(m.attrs.name ?? "") && /noindex/i.test(m.attrs.content ?? ""));
      if (meta) return { detail: "A robots meta tag says noindex.", evidence: [showTag(meta)] };
      return /noindex/i.test(c.header("x-robots-tag")) ? { detail: "The X-Robots-Tag header says noindex.", evidence: [`x-robots-tag: ${c.header("x-robots-tag")}`] } : null;
    },
  },
  {
    id: "title",
    category: "seo",
    severity: "medium",
    title: "Missing or weak page title",
    pass: "Has a good <title>",
    why: "The title is the blue link people click in Google results and the text on the browser tab. Too short says nothing; too long gets cut off.",
    fix: "Write a unique title of about 30–60 characters that says what the page is, e.g. 'Fresh groceries in 10 minutes · QuickCart'.",
    run: (c) => {
      const t = textOf(c.doc.elements("title")[0]?.inner ?? "");
      if (!t) return { detail: "There's no <title>.", severity: "high" };
      if (t.length < 10 || t.length > 65) return { title: `The page title is too ${t.length < 10 ? "short" : "long"}`, detail: `The title is ${t.length} characters: "${clip(t, 80)}".`, severity: "low" };
      return null;
    },
  },
  {
    id: "description",
    category: "seo",
    severity: "medium",
    title: "Missing or weak meta description",
    pass: "Has a meta description",
    why: "The description is the grey text under your link in search results. Without one, Google picks random text from the page.",
    fix: 'Add <meta name="description" content="…"> with 70–160 characters that sell the page.',
    run: (c) => {
      const d = c.doc.byName("meta").find((m) => (m.attrs.name ?? "").toLowerCase() === "description")?.attrs.content?.trim() ?? "";
      if (!d) return { detail: "No meta description." };
      return d.length < 50 || d.length > 170 ? { title: `The meta description is too ${d.length < 50 ? "short" : "long"}`, detail: `The description is ${d.length} characters.`, evidence: [clip(d, 170)], severity: "low" } : null;
    },
  },
  {
    id: "h1",
    category: "seo",
    severity: "low",
    title: "The page doesn't have exactly one main heading (<h1>)",
    pass: "One main heading (<h1>)",
    why: "The <h1> tells search engines and screen-reader users what the page is about. None — or several competing ones — blurs that.",
    fix: "Give the page one <h1> with its main topic; use <h2>–<h3> for sections.",
    run: (c) => {
      const n = c.doc.byName("h1").length;
      return n === 1 ? null : { detail: n === 0 ? "No <h1> on the page." : `${n} <h1> headings.`, evidence: c.doc.elements("h1").slice(0, 3).map((h) => `<h1>${clip(textOf(h.inner), 80)}</h1>`) };
    },
  },
  {
    id: "viewport",
    category: "seo",
    severity: "medium",
    title: "Not set up for phones (no viewport tag)",
    pass: "Mobile-friendly viewport",
    why: 'Without <meta name="viewport"> phones show a tiny zoomed-out desktop page. Google ranks mobile-unfriendly pages lower.',
    fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    run: (c) => (c.doc.byName("meta").some((m) => (m.attrs.name ?? "").toLowerCase() === "viewport") ? null : { detail: "No viewport meta tag." }),
  },
  {
    id: "canonical",
    category: "seo",
    severity: "low",
    title: "No canonical URL",
    pass: "Has a canonical URL",
    why: "The same page is often reachable at several addresses (with ?utm=…, with or without www). The canonical link tells Google which one counts.",
    fix: 'Add <link rel="canonical" href="https://your-site/the-page">.',
    run: (c) => (c.doc.byName("link").some((l) => /(^|\s)canonical(\s|$)/i.test(l.attrs.rel ?? "")) ? null : { detail: "No <link rel=\"canonical\">." }),
  },
  {
    id: "social",
    category: "seo",
    severity: "low",
    title: "No social preview (Open Graph)",
    pass: "Has a social preview (Open Graph)",
    why: "When someone shares the link on WhatsApp, LinkedIn or X, these tags decide the title, text and image in the preview card. Without them it looks bare.",
    fix: "Add og:title, og:description and og:image (1200×630) meta tags, plus twitter:card = summary_large_image.",
    run: (c) => {
      const og = (p: string) => c.doc.byName("meta").some((m) => (m.attrs.property ?? m.attrs.name ?? "").toLowerCase() === p);
      const miss = ["og:title", "og:description", "og:image"].filter((p) => !og(p));
      return miss.length ? { detail: `Missing ${miss.join(", ")}.` } : null;
    },
  },
  {
    id: "robots-txt",
    category: "seo",
    severity: "low",
    title: "robots.txt is missing or blocks everything",
    pass: "robots.txt is in place",
    why: "robots.txt tells search engines what they may crawl. 'Disallow: /' for every bot hides the whole site.",
    fix: "Serve /robots.txt that allows crawling (and lists your sitemap). Only block private areas.",
    run: (c) => {
      if (!c.f.robots) return "skip";
      if (c.f.robots.status !== 200) return { detail: `/robots.txt answered ${c.f.robots.status}.` };
      const groups = c.f.robots.text.split(/\n(?=\s*user-agent\s*:)/i);
      const all = groups.find((g) => /user-agent\s*:\s*\*/i.test(g));
      return all && /^\s*disallow\s*:\s*\/\s*$/im.test(all) ? { detail: "robots.txt blocks every crawler from the whole site.", evidence: ["User-agent: *", "Disallow: /"], severity: "high" } : null;
    },
  },
  {
    id: "sitemap",
    category: "seo",
    severity: "low",
    title: "No sitemap",
    pass: "Has a sitemap",
    why: "A sitemap lists every page you want found, so search engines don't miss pages that few links point to.",
    fix: "Generate /sitemap.xml (most frameworks and CMSs can) and add Sitemap: https://your-site/sitemap.xml to robots.txt.",
    run: (c) => (!c.f.sitemap ? "skip" : c.f.sitemap.status === 200 ? null : { detail: `${c.f.sitemap.url} answered ${c.f.sitemap.status}.` }),
  },
  {
    id: "structured-data",
    category: "seo",
    severity: "low",
    title: "No structured data",
    pass: "Has structured data (JSON-LD)",
    why: "Structured data (schema.org JSON-LD) lets Google show rich results — ratings, prices, FAQs, the logo — instead of a plain blue link.",
    fix: 'Add a <script type="application/ld+json"> block describing the page: Organization, Product, Article or FAQPage.',
    run: (c) => (c.doc.scripts.some((s) => /ld\+json/i.test(s.attrs.type ?? "")) || /itemscope/.test(c.doc.scan) ? null : { detail: "No JSON-LD or microdata found." }),
  },
  {
    id: "favicon",
    category: "seo",
    severity: "low",
    title: "No favicon declared",
    pass: "Has a favicon",
    why: "The little icon on the browser tab and in Google's mobile results — without it the site looks unfinished.",
    fix: 'Add <link rel="icon" href="/favicon.ico"> (and an apple-touch-icon for phones).',
    run: (c) => (c.doc.byName("link").some((l) => /icon/i.test(l.attrs.rel ?? "")) ? null : { detail: 'No <link rel="icon">.' }),
  },

  /* ── accessibility ── */
  {
    id: "lang",
    category: "accessibility",
    severity: "medium",
    title: "The page doesn't say what language it's in",
    pass: "Declares its language",
    why: 'Screen readers pick their voice and pronunciation from <html lang>. Without it, Hindi or English text can be read out in the wrong accent — or as gibberish.',
    fix: 'Add the language to the html tag: <html lang="en"> (or "hi", "mr"…).',
    run: (c) => (c.doc.byName("html")[0]?.attrs.lang ? null : { detail: "<html> has no lang attribute." }),
  },
  {
    id: "img-alt",
    category: "accessibility",
    severity: "medium",
    title: "Images without alt text",
    pass: "Images have alt text",
    why: "Blind visitors hear the alt text instead of seeing the image. Without it, a screen reader reads the file name — or skips something important like a button.",
    fix: 'Describe each meaningful image in alt="…"; give purely decorative images an empty alt="".',
    run: (c) => {
      const imgs = c.doc.byName("img");
      if (!imgs.length) return "skip";
      const bad = imgs.filter((t) => !("alt" in t.attrs) && t.attrs["aria-hidden"] !== "true" && t.attrs.role !== "presentation");
      return bad.length ? { detail: `${bad.length} of ${imgs.length} images have no alt attribute.`, evidence: bad.slice(0, 3).map(showTag), severity: bad.length > 5 ? "high" : "medium" } : null;
    },
  },
  {
    id: "link-names",
    category: "accessibility",
    severity: "medium",
    title: "Links with no readable text",
    pass: "Links have readable text",
    why: "A screen reader announces a link by its text. An icon-only link with no label is read as just 'link' — the visitor can't tell where it goes.",
    fix: 'Give icon links an aria-label ("Open cart", "Instagram") or visually-hidden text.',
    run: (c) => {
      const bad = c.doc.elements("a").filter((a) => a.attrs.href !== undefined && !named(a.attrs, a.inner));
      return bad.length ? { detail: `${plural(bad.length, "link")} without text or a label.`, evidence: bad.slice(0, 3).map((a) => clip(a.raw.replace(/\s+/g, " "), 140)) } : null;
    },
  },
  {
    id: "button-names",
    category: "accessibility",
    severity: "medium",
    title: "Buttons with no readable name",
    pass: "Buttons have readable names",
    why: "An icon-only button (☰, ✕, 🔍) with no label is announced as just 'button'. Keyboard and screen-reader users can't tell what it does.",
    fix: 'Add aria-label="Close menu" (or similar) to icon-only buttons.',
    run: (c) => {
      const bad = c.doc.elements("button").filter((b) => !named(b.attrs, b.inner));
      return bad.length ? { detail: `${plural(bad.length, "button")} without a name.`, evidence: bad.slice(0, 3).map((b) => clip(b.raw.replace(/\s+/g, " "), 140)) } : null;
    },
  },
  {
    id: "form-labels",
    category: "accessibility",
    severity: "medium",
    title: "Form fields without labels",
    pass: "Form fields have labels",
    why: "A placeholder disappears as soon as you type and isn't always read out. Without a <label>, screen-reader users don't know what to type — and the click target is smaller for everyone.",
    fix: 'Pair every field with <label for="email">Email</label>, or add aria-label when a visible label doesn\'t fit the design.',
    run: (c) => {
      const labelled = new Set(c.doc.byName("label").map((l) => l.attrs.for).filter(Boolean));
      const wrapped = new Set<number>();
      for (const l of c.doc.elements("label")) for (const m of l.inner.matchAll(/<(input|select|textarea)\b/gi)) wrapped.add(1 + (m.index ?? 0));
      const fields = c.doc.tags.filter((t) => (t.name === "input" && !/^(hidden|submit|button|reset|image|checkbox|radio)$/i.test(t.attrs.type ?? "text")) || t.name === "select" || t.name === "textarea");
      if (!fields.length) return "skip";
      const wrappedCount = wrapped.size;
      const bad = fields.filter((t) => !(t.attrs.id && labelled.has(t.attrs.id)) && !t.attrs["aria-label"] && !t.attrs["aria-labelledby"] && !t.attrs.title);
      const n = Math.max(0, bad.length - wrappedCount);
      return n ? { detail: `${n} of ${fields.length} form fields have no label.`, evidence: bad.slice(0, 3).map(showTag) } : null;
    },
  },
  {
    id: "zoom",
    category: "accessibility",
    severity: "medium",
    title: "Zooming is turned off",
    pass: "Visitors can zoom",
    why: "People with low vision pinch to zoom. user-scalable=no or maximum-scale=1 takes that away.",
    fix: 'Remove user-scalable=no and maximum-scale from the viewport tag: content="width=device-width, initial-scale=1".',
    run: (c) => {
      const v = c.doc.byName("meta").find((m) => (m.attrs.name ?? "").toLowerCase() === "viewport");
      if (!v) return "skip";
      const content = v.attrs.content ?? "";
      const max = Number(content.match(/maximum-scale\s*=\s*([\d.]+)/i)?.[1] ?? 5);
      return /user-scalable\s*=\s*(no|0)/i.test(content) || max < 2 ? { detail: "The viewport tag blocks zooming.", evidence: [showTag(v)] } : null;
    },
  },
  {
    id: "headings-order",
    category: "accessibility",
    severity: "low",
    title: "Heading levels skip (e.g. h1 → h3)",
    pass: "Headings go in order",
    why: "Screen-reader users jump between headings like a table of contents. Skipped levels make the page structure confusing.",
    fix: "Use headings in order — h1, then h2 for sections, h3 inside those — and style them with CSS instead of picking a level by its size.",
    run: (c) => {
      const hs = c.doc.tags.filter((t) => /^h[1-6]$/.test(t.name)).map((t) => Number(t.name[1]));
      if (hs.length < 3) return "skip";
      const skips: string[] = [];
      for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) skips.push(`h${hs[i - 1]} → h${hs[i]}`);
      return skips.length ? { detail: `${plural(skips.length, "skip")} in the heading order.`, evidence: [...new Set(skips)].slice(0, 4) } : null;
    },
  },
  {
    id: "main-landmark",
    category: "accessibility",
    severity: "low",
    title: "No <main> landmark",
    pass: "Has a <main> landmark",
    why: "<main> lets keyboard and screen-reader users skip the menu and jump straight to the content.",
    fix: 'Wrap the page\'s main content in <main> (one per page), or add role="main".',
    run: (c) => (c.doc.byName("main").length || c.doc.tags.some((t) => t.attrs.role === "main") ? null : { detail: "No <main> element." }),
  },
  {
    id: "tabindex",
    category: "accessibility",
    severity: "low",
    title: "Positive tabindex values change the Tab order",
    pass: "Natural keyboard order",
    why: "tabindex above 0 makes the Tab key jump around the page in a surprising order.",
    fix: 'Use tabindex="0" (or nothing) and arrange the HTML in a logical order instead.',
    run: (c) => {
      const bad = c.doc.tags.filter((t) => Number(t.attrs.tabindex) > 0);
      return bad.length ? { detail: `${plural(bad.length, "element")} with tabindex > 0.`, evidence: bad.slice(0, 3).map(showTag) } : null;
    },
  },
  {
    id: "iframe-title",
    category: "accessibility",
    severity: "low",
    title: "Embedded frames without a title",
    pass: "Embedded frames have titles",
    why: "A screen reader announces an iframe by its title. Without one, a map or video is just 'frame'.",
    fix: 'Add title="Map of our office" (or similar) to every <iframe>.',
    run: (c) => {
      const f = c.doc.byName("iframe");
      if (!f.length) return "skip";
      const bad = f.filter((t) => !t.attrs.title && !t.attrs["aria-label"]);
      return bad.length ? { detail: `${bad.length} of ${f.length} iframes have no title.`, evidence: bad.slice(0, 2).map(showTag) } : null;
    },
  },
  {
    id: "autoplay",
    category: "accessibility",
    severity: "low",
    title: "Media plays sound by itself",
    pass: "No media autoplays with sound",
    why: "Sound that starts on its own talks over screen readers and startles people in quiet places.",
    fix: "Only autoplay muted video (add muted and playsinline), and give every video controls.",
    run: (c) => {
      const bad = c.doc.tags.filter((t) => (t.name === "video" || t.name === "audio") && "autoplay" in t.attrs && !("muted" in t.attrs));
      return bad.length ? { detail: `${plural(bad.length, "media element")} autoplay without muted.`, evidence: bad.slice(0, 2).map(showTag) } : null;
    },
  },
  {
    id: "duplicate-ids",
    category: "accessibility",
    severity: "low",
    title: "The same id is used more than once",
    pass: "ids are unique",
    why: "Labels, skip links and aria references point at an id. If two elements share it, they point at the wrong one.",
    fix: "Make every id unique on the page (components rendered twice often cause this).",
    run: (c) => {
      const seen = new Map<string, number>();
      for (const t of c.doc.tags) if (t.attrs.id) seen.set(t.attrs.id, (seen.get(t.attrs.id) ?? 0) + 1);
      const d = [...seen].filter(([, n]) => n > 1);
      return d.length ? { detail: `${plural(d.length, "id")} used more than once.`, evidence: d.slice(0, 4).map(([id, n]) => `id="${clip(id, 40)}" × ${n}`) } : null;
    },
  },

  /* ── good practice ── */
  {
    id: "doctype",
    category: "best",
    severity: "low",
    title: "No <!DOCTYPE html>",
    pass: "Has <!DOCTYPE html>",
    why: "Without the doctype, browsers fall back to 'quirks mode' and lay the page out with old, inconsistent rules.",
    fix: "Put <!DOCTYPE html> as the very first line.",
    run: (c) => (/^\s*(<\?xml[^>]*>\s*)?<!doctype\s+html/i.test(c.f.html) ? null : { detail: "The page doesn't start with a doctype." }),
  },
  {
    id: "charset",
    category: "best",
    severity: "low",
    title: "No character encoding declared",
    pass: "Declares UTF-8",
    why: "Without a charset, characters like ₹, é or Devanagari can show up as garbage (�).",
    fix: 'Add <meta charset="utf-8"> near the top of <head>.',
    run: (c) => (c.doc.byName("meta").some((m) => "charset" in m.attrs || /charset/i.test(m.attrs.content ?? "")) || /charset=/i.test(c.header("content-type")) ? null : { detail: "No charset in the meta tags or the Content-Type header." }),
  },
  {
    id: "deprecated-tags",
    category: "best",
    severity: "low",
    title: "Uses HTML tags that no longer exist",
    pass: "No obsolete HTML tags",
    why: "<font>, <center>, <marquee> and friends were removed from HTML. They may stop working and mix styling into content.",
    fix: "Replace them with CSS (text-align, font-family, animations).",
    run: (c) => {
      const bad = c.doc.tags.filter((t) => ["font", "center", "marquee", "blink", "big", "strike", "tt", "frameset", "frame"].includes(t.name));
      return bad.length ? { detail: `${plural(bad.length, "obsolete tag")}.`, evidence: [...new Set(bad.map((t) => `<${t.name}>`))].slice(0, 5) } : null;
    },
  },
  {
    id: "document-write",
    category: "best",
    severity: "low",
    title: "Uses document.write()",
    pass: "No document.write()",
    why: "document.write blocks the page while it runs, and Chrome refuses it on slow connections — so whatever it adds may never appear.",
    fix: "Create elements with document.createElement and append them, or load the script with async.",
    run: (c) => {
      const n = c.doc.scripts.filter((s) => !s.attrs.src && /document\.write(ln)?\s*\(/.test(s.body)).length;
      return n ? { detail: `${plural(n, "inline script")} call document.write().` } : null;
    },
  },
  {
    id: "inline-handlers",
    category: "best",
    severity: "low",
    title: "Lots of inline onclick=\"…\" handlers",
    pass: "Few inline event handlers",
    why: "JavaScript inside HTML attributes is hard to maintain and forces a weaker Content-Security-Policy ('unsafe-inline').",
    fix: "Attach events from your script files with addEventListener (or your framework's onClick).",
    run: (c) => {
      const n = c.doc.tags.filter((t) => Object.keys(t.attrs).some((k) => /^on[a-z]+$/.test(k))).length;
      return n > 10 ? { detail: `${n} elements with on…="…" attributes.` } : null;
    },
  },
  {
    id: "inline-js",
    category: "best",
    severity: "low",
    title: "A lot of JavaScript is written inside the HTML",
    pass: "Inline JavaScript is small",
    why: "Inline scripts can't be cached separately, so every visit downloads them again with the page.",
    fix: "Move large inline scripts into .js files the browser can cache.",
    run: (c) => {
      const n = c.doc.scripts.filter((s) => !s.attrs.src && !/json/i.test(s.attrs.type ?? "")).reduce((a, s) => a + s.body.length, 0);
      return n > 100 * 1024 ? { detail: `About ${kb(n)} KB of inline JavaScript.` } : null;
    },
  },
];

/** Does an <a> / <button> have a name a screen reader can read? */
function named(attrs: Record<string, string>, inner: string): boolean {
  if ((attrs["aria-label"] ?? "").trim() || attrs["aria-labelledby"] || (attrs.title ?? "").trim()) return true;
  if (textOf(inner).length) return true;
  if (/<img\b[^>]*\balt\s*=\s*["'][^"']+["']/i.test(inner)) return true;
  if (/aria-label\s*=\s*["'][^"']+["']|<title>[^<]+<\/title>/i.test(inner)) return true;
  return false;
}

function thirdParties(c: Ctx): string[] {
  const out = new Set<string>();
  for (const t of c.doc.tags) {
    const u = t.name === "script" || t.name === "img" || t.name === "iframe" ? t.attrs.src : t.name === "link" ? t.attrs.href : undefined;
    if (!u) continue;
    const a = abs(u, c.f.url);
    if (a && c.ext(a)) out.add(siteOf(hostOf(a)));
  }
  return [...out].sort();
}

/* ───────────────────────── the report ───────────────────────── */

const WEIGHT: Record<SiteSeverity, number> = { high: 3, medium: 2, low: 1 };
const CAT_WEIGHT: Record<SiteCategory, number> = { security: 1.3, performance: 1, seo: 1, accessibility: 1, best: 0.7 };
const SEV_ORDER: Record<SiteSeverity, number> = { high: 0, medium: 1, low: 2 };
const CAT_ORDER: SiteCategory[] = ["security", "performance", "seo", "accessibility", "best"];

export function auditSite(f: SiteFetch): SiteReport {
  const doc = readHtml(f.html);
  const headers = Object.fromEntries(Object.entries(f.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const header = (k: string) => headers[k] ?? "";
  const srcs = doc.byName("script").map((t) => t.attrs.src).filter((x): x is string => !!x);
  const links = doc.byName("link").map((t) => t.attrs.href).filter((x): x is string => !!x);
  const generator = doc.byName("meta").find((m) => (m.attrs.name ?? "").toLowerCase() === "generator")?.attrs.content ?? "";
  const seen: Seen = { f, doc, srcs, links, all: [...srcs, ...links, ...doc.byName("img").map((t) => t.attrs.src ?? "")].join("\n"), header, generator };

  const tech: SiteTech[] = [];
  for (const t of TECH) {
    let ev: string | null = null;
    try {
      ev = t.find(seen);
    } catch {
      ev = null;
    }
    if (ev) tech.push({ name: t.name, kind: t.kind, version: t.version?.(seen) ?? null, evidence: clip(ev, 90) });
  }

  const host = hostOf(f.url);
  const firstParty = siteOf(host);
  const ctx: Ctx = {
    ...seen,
    https: /^https:/i.test(f.url),
    firstParty,
    ext: (u: string) => {
      const a = abs(u, f.url);
      if (!a || !/^https?:/i.test(a)) return false;
      return siteOf(hostOf(a)) !== firstParty;
    },
    tech,
  };

  const issues: SiteIssue[] = [];
  const passed: SiteReport["passed"] = [];
  const tally = new Map<SiteCategory, { got: number; total: number; passed: number; n: number }>();
  for (const c of CHECKS) {
    let r: Result;
    try {
      r = c.run(ctx);
    } catch {
      r = "skip";
    }
    if (r === "skip") continue;
    const t = tally.get(c.category) ?? { got: 0, total: 0, passed: 0, n: 0 };
    const sev = r?.severity ?? c.severity;
    t.total += WEIGHT[sev];
    t.n++;
    if (r === null) {
      t.got += WEIGHT[sev];
      t.passed++;
      passed.push({ category: c.category, title: c.pass });
    } else issues.push({ id: c.id, category: c.category, severity: sev, title: r.title ?? c.title, detail: r.detail, why: c.why, fix: c.fix, evidence: (r.evidence ?? []).slice(0, 4) });
    tally.set(c.category, t);
  }
  issues.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));

  const categories = CAT_ORDER.filter((id) => tally.has(id)).map((id) => {
    const t = tally.get(id)!;
    return { id, label: SITE_CATEGORY_LABEL[id], score: t.total ? Math.round((100 * t.got) / t.total) : 100, passed: t.passed, total: t.n };
  });
  const wsum = categories.reduce((n, c) => n + CAT_WEIGHT[c.id], 0);
  let score = Math.round(categories.reduce((n, c) => n + c.score * CAT_WEIGHT[c.id], 0) / Math.max(0.01, wsum));
  if (issues.some((i) => i.severity === "high" && i.category === "security")) score = Math.min(score, 79);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "E";

  const meta = (p: string) => doc.byName("meta").find((m) => (m.attrs.property ?? m.attrs.name ?? "").toLowerCase() === p)?.attrs.content?.trim() || null;
  const title = textOf(doc.elements("title")[0]?.inner ?? "") || meta("og:title");
  const icon = doc.byName("link").find((l) => /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(l.attrs.rel ?? ""))?.attrs.href;
  const img = meta("og:image") ?? meta("twitter:image");
  const imgs = doc.byName("img");
  const scripts = doc.byName("script");
  const sampledBytes = f.resources.reduce((n, r) => n + (r.bytes ?? 0), 0);
  const tp = thirdParties(ctx);

  const highs = issues.filter((i) => i.severity === "high");
  const built = tech.filter((t) => !["Hosting / CDN", "Web server", "CDN", "Fonts", "Icons"].includes(t.kind)).slice(0, 3).map((t) => t.name);
  const hosting = tech.find((t) => t.kind === "Hosting / CDN")?.name;
  const summary =
    `${built.length ? `Built with ${listWords(built)}` : "Built with no framework we recognise"}${hosting ? `, served through ${hosting}` : ""}. ` +
    (issues.length
      ? `${plural(issues.length, "thing")} to improve${highs.length ? ` — ${highs.length} serious: ${listWords(highs.slice(0, 2).map((h) => h.title.charAt(0).toLowerCase() + h.title.slice(1)))}` : ""}.`
      : "Nothing to fix in the checks we ran — nicely done.");

  return {
    kind: "site",
    site: {
      input: f.input,
      url: f.url,
      host,
      title: title ? clip(title, 120) : null,
      description: meta("description") ?? meta("og:description"),
      favicon: abs(icon, f.url) ?? abs("/favicon.ico", f.url),
      image: img ? abs(img, f.url) : null,
      lang: doc.byName("html")[0]?.attrs.lang ?? null,
      https: ctx.https,
      status: f.status,
      server: header("server") || null,
      redirects: f.redirects,
    },
    score,
    grade,
    summary,
    categories,
    tech,
    issues,
    passed,
    metrics: {
      html_kb: kb(f.html_bytes),
      ttfb_ms: Math.round(f.ttfb_ms),
      total_ms: Math.round(f.total_ms),
      scripts: scripts.length,
      external_scripts: scripts.filter((t) => t.attrs.src).length,
      styles: doc.byName("link").filter((l) => /stylesheet/i.test(l.attrs.rel ?? "")).length + doc.styles.length,
      images: imgs.length,
      links: doc.byName("a").length,
      tags: doc.tags.length,
      third_party: tp,
      sampled: f.resources.length,
      sampled_kb: kb(sampledBytes),
      inline_script_kb: kb(doc.scripts.filter((s) => !s.attrs.src).reduce((n, s) => n + s.body.length, 0)),
    },
    truncated: f.truncated,
  };
}

function listWords(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Which page resources are worth a HEAD request: own scripts and styles first, then the first images. */
export function pickResources(html: string, base: string, max = 14): { url: string; type: SiteResource["type"] }[] {
  const doc = readHtml(html);
  const out: { url: string; type: SiteResource["type"] }[] = [];
  const add = (u: string | undefined, type: SiteResource["type"]) => {
    const a = abs(u, base);
    if (a && /^https?:/i.test(a) && !out.some((x) => x.url === a)) out.push({ url: a, type });
  };
  const own = (u: string | undefined) => {
    const a = abs(u, base);
    return !!a && siteOf(hostOf(a)) === siteOf(hostOf(base));
  };
  const scripts = doc.byName("script").map((t) => t.attrs.src);
  const styles = doc.byName("link").filter((l) => /stylesheet/i.test(l.attrs.rel ?? "")).map((l) => l.attrs.href);
  for (const s of scripts.filter(own).slice(0, 5)) add(s, "script");
  for (const s of styles.filter(own).slice(0, 3)) add(s, "style");
  for (const s of scripts.filter((x) => x && !own(x)).slice(0, 2)) add(s, "script");
  for (const t of doc.byName("img").slice(0, 8)) {
    const src = t.attrs.src && !/^data:/.test(t.attrs.src) ? t.attrs.src : t.attrs["data-src"];
    add(src, "image");
  }
  return out.slice(0, max);
}

/* ───────────────────────── Ask Priya, offline ───────────────────────── */

export function siteAnswer(question: string, r: SiteReport): string {
  const q = question.toLowerCase();
  const cat: SiteCategory | null = /secur|hack|safe|header|cookie|https/.test(q) ? "security" : /speed|slow|fast|perf|load/.test(q) ? "performance" : /seo|google|search|rank/.test(q) ? "seo" : /access|screen reader|blind|alt|label/.test(q) ? "accessibility" : null;
  const pool = cat ? r.issues.filter((i) => i.category === cat) : r.issues;
  if (/built|tech|stack|framework|made with|using/.test(q))
    return r.tech.length ? `${r.site.host} is built with ${listWords(r.tech.slice(0, 6).map((t) => (t.version ? `${t.name} ${t.version}` : t.name)))}. I can tell from things like ${r.tech[0].evidence}.` : "I couldn't recognise a framework from the page itself — it may be plain HTML or server-rendered without tell-tale files.";
  if (!pool.length) return cat ? `Nothing failed in ${SITE_CATEGORY_LABEL[cat].toLowerCase()} — that part looks good.` : "Nothing failed in the checks I ran. Next step: test it on a real phone and with a screen reader.";
  const top = pool[0];
  return `Start with "${top.title}". ${top.detail} ${top.why} Fix: ${top.fix}${pool.length > 1 ? ` After that, look at "${pool[1].title}".` : ""}`;
}
