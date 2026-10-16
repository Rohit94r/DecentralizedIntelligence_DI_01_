/**
 * Repo Analyse — code-level bug detectors: line-based, language-aware rules
 * over the files we read, each with a snippet, why it's a bug and the fix.
 * Lines that might hold a secret never appear in a snippet.
 */
import { type BugCategory, JUNK_DIR, NOT_PRODUCT, PRACTICE_FILE, type RepoBug, type RepoSnapshot, SEV_RANK, type Severity, TEST_PATH, isCode, looksSecret, uniq } from "./repo-shared.ts";

/* ───────────────────────── bugs: line-based detectors over the files we read ───────────────────────── */

export const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type SrcKind = "js" | "py" | "java";

export interface SrcFile {
  path: string;
  kind: SrcKind;
  raw: string[];
  /** the same lines with string contents replaced by "x" and comments blanked — so rules only match real code */
  code: string[];
}

export interface Hit {
  line: number;
  title?: string;
  why?: string;
  severity?: Severity;
  confidence?: "likely" | "possible";
}

export interface BugRule {
  id: string;
  kinds: SrcKind[];
  severity: Severity;
  confidence: "likely" | "possible";
  category: BugCategory;
  title: string;
  why: string;
  fix: string;
  learn: string;
  practice: "factory" | "bounty" | "practice";
  find: (f: SrcFile) => Hit[];
}

export function regexCanStart(prefix: string): boolean {
  const t = prefix.trimEnd();
  if (!t || t.endsWith("=>")) return true;
  if ("(,=:[!&|?{};+-*%~^".includes(t[t.length - 1])) return true;
  return /\b(return|typeof|case|do|else|in|of|yield|await|void|delete|throw|new)$/.test(t);
}

/** Blank comments and the inside of strings / template literals / regex literals (JS, TS, Java). Columns stay aligned. */
export function maskCLike(lines: string[], js: boolean): string[] {
  type Frame = { k: "code"; depth: number } | { k: "tpl" } | { k: "block" };
  const stack: Frame[] = [{ k: "code", depth: 0 }];
  return lines.map((line) => {
    let o = "";
    let i = 0;
    const n = line.length;
    while (i < n) {
      const top = stack[stack.length - 1];
      const c = line[i];
      const d = line[i + 1];
      if (top.k === "block") {
        if (c === "*" && d === "/") {
          o += "  ";
          i += 2;
          stack.pop();
        } else {
          o += " ";
          i++;
        }
        continue;
      }
      if (top.k === "tpl") {
        if (c === "\\") {
          const k = Math.min(2, n - i);
          o += "x".repeat(k);
          i += k;
        } else if (c === "`") {
          o += "`";
          i++;
          stack.pop();
        } else if (c === "$" && d === "{") {
          o += "${";
          i += 2;
          stack.push({ k: "code", depth: 0 });
        } else {
          o += "x";
          i++;
        }
        continue;
      }
      if (c === "/" && d === "/") {
        o += " ".repeat(n - i);
        break;
      }
      if (c === "/" && d === "*") {
        o += "  ";
        i += 2;
        stack.push({ k: "block" });
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && line[j] !== c) j += line[j] === "\\" ? 2 : 1;
        if (j >= n) {
          o += c + "x".repeat(n - i - 1);
          i = n;
        } else {
          o += c + "x".repeat(j - i - 1) + c;
          i = j + 1;
        }
        continue;
      }
      if (js && c === "`") {
        o += "`";
        i++;
        stack.push({ k: "tpl" });
        continue;
      }
      if (js && c === "/" && regexCanStart(o)) {
        let j = i + 1;
        let cls = false;
        while (j < n) {
          const e = line[j];
          if (e === "\\") {
            j += 2;
            continue;
          }
          if (cls) {
            if (e === "]") cls = false;
          } else if (e === "[") cls = true;
          else if (e === "/") break;
          j++;
        }
        if (j < n) {
          o += "/" + "x".repeat(j - i - 1) + "/";
          i = j + 1;
          continue;
        }
      }
      if (stack.length > 1 && top.k === "code") {
        if (c === "{") top.depth++;
        else if (c === "}") {
          if (top.depth === 0) {
            stack.pop();
            o += c;
            i++;
            continue;
          }
          top.depth--;
        }
      }
      o += c;
      i++;
    }
    return o;
  });
}

/** Blank comments and the inside of strings (including triple-quoted docstrings) in Python. */
export function maskPy(lines: string[]): string[] {
  let tri: string | null = null;
  return lines.map((line) => {
    let o = "";
    let i = 0;
    const n = line.length;
    while (i < n) {
      if (tri) {
        const end = line.indexOf(tri, i);
        if (end < 0) {
          o += "x".repeat(n - i);
          i = n;
        } else {
          o += "x".repeat(end - i) + tri;
          i = end + 3;
          tri = null;
        }
        continue;
      }
      const c = line[i];
      if (c === "#") {
        o += " ".repeat(n - i);
        break;
      }
      if ((c === '"' || c === "'") && line.startsWith(c.repeat(3), i)) {
        tri = c.repeat(3);
        o += tri;
        i += 3;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && line[j] !== c) j += line[j] === "\\" ? 2 : 1;
        if (j >= n) {
          o += c + "x".repeat(n - i - 1);
          i = n;
        } else {
          o += c + "x".repeat(j - i - 1) + c;
          i = j + 1;
        }
        continue;
      }
      o += c;
      i++;
    }
    return o;
  });
}

export const indentOf = (l: string) => l.length - l.trimStart().length;

/** Lines in the Python block that starts after line i (deeper indentation). */
export function pyBlock(code: string[], i: number, max = 40): number[] {
  const ind = indentOf(code[i]);
  const out: number[] = [];
  for (let j = i + 1; j < Math.min(code.length, i + 1 + max); j++) {
    if (!code[j].trim()) continue;
    if (indentOf(code[j]) <= ind) break;
    out.push(j);
  }
  return out;
}

/** The text of a JS/Java statement that opens a block on line i: from line i to its matching close brace (or the next line). */
export function cBlock(code: string[], i: number, max = 40): string {
  let depth = 0;
  let opened = false;
  const parts: string[] = [];
  for (let j = i; j < Math.min(code.length, i + max); j++) {
    parts.push(code[j]);
    for (const ch of code[j]) {
      if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") depth--;
    }
    if (opened && depth <= 0) break;
    if (!opened && j > i) break;
  }
  return parts.join("\n");
}

/** The text of a call that starts at (i, col) until its parentheses balance. */
export function callText(code: string[], i: number, col: number, max = 10): string {
  let depth = 0;
  let seen = false;
  let out = "";
  for (let j = i; j < Math.min(code.length, i + max); j++) {
    const l = j === i ? code[j].slice(col) : code[j];
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      out += ch;
      if (ch === "(") {
        depth++;
        seen = true;
      } else if (ch === ")") {
        depth--;
        if (seen && depth === 0) return out;
      }
    }
    out += "\n";
  }
  return out;
}

/** Is line i inside a try { … } block? (walks braces backwards) */
export function jsInTry(code: string[], i: number, col: number): boolean {
  if (/\btry\b/.test(code[i].slice(0, col))) return true;
  let depth = 0;
  for (let j = i - 1; j >= Math.max(0, i - 120); j--) {
    const l = code[j];
    for (let k = l.length - 1; k >= 0; k--) {
      if (l[k] === "}") depth++;
      else if (l[k] === "{") {
        if (depth === 0) {
          if (/\btry\s*$/.test(l.slice(0, k)) || (!l.slice(0, k).trim() && j > 0 && /\btry\s*$/.test(code[j - 1]))) return true;
        } else depth--;
      }
    }
  }
  return false;
}

/** Is line i inside a Python try: block? (walks indentation backwards) */
export function pyInTry(code: string[], i: number): boolean {
  let cur = indentOf(code[i]);
  for (let j = i - 1; j >= Math.max(0, i - 120) && cur > 0; j--) {
    const l = code[j];
    if (!l.trim()) continue;
    const d = indentOf(l);
    if (d < cur) {
      if (/^\s*try\s*:/.test(l)) return true;
      if (/^\s*(async\s+)?(def|class)\b/.test(l)) return false;
      cur = d;
    }
  }
  return false;
}

/** Every line whose code matches re. */
export function each(f: SrcFile, re: RegExp, guard?: (i: number, m: RegExpExecArray) => boolean | Hit | null): Hit[] {
  const out: Hit[] = [];
  f.code.forEach((l, i) => {
    if (l.length > 1500) return;
    const m = re.exec(l);
    if (!m) return;
    const g = guard ? guard(i, m) : true;
    if (g === true) out.push({ line: i + 1 });
    else if (g && typeof g === "object") out.push({ ...g, line: i + 1 });
  });
  return out;
}

export const PW_SIDE = String.raw`[\w$.\[\]]*(?:[Pp]assw(?:or)?d|PASSW(?:OR)?D|[Pp]wd|PWD)[\w$]*`;
export const PW_CMP = new RegExp(`(${PW_SIDE})\\s*(?:===?|!==?)\\s*(${PW_SIDE})`);
export const PY_BUILTINS = "list|dict|str|int|float|id|input|sum|max|min|len|type|set|map|filter|range|open|print|object|next|iter|tuple|sorted|any|all|format|hash|bytes|zip|round|abs|bool|vars|dir";
/** Does this variable / function name hold something secret? Works on words: secret_number (a guessing game) is not. */
export function secretishName(name: string): boolean {
  const w = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_$\s]+/)
    .filter(Boolean)
    .filter((x) => !["get", "make", "generate", "gen", "create", "new", "random", "rand", "build"].includes(x));
  const has = (x: string) => w.includes(x);
  if (["token", "otp", "password", "passwd", "pwd", "salt", "nonce", "apikey", "csrf", "passcode"].some(has)) return true;
  if (has("secret")) return w.length === 1 || has("key");
  return (has("api") && has("key")) || (has("session") && has("id")) || (["reset", "verification", "verify", "invite", "auth", "otp"].some(has) && has("code"));
}
/** HTML that comes out of an escaping / highlighting / sanitising helper is treated as safe by the XSS rules. */
export const SAFE_HTML_FN = /highlight|escape|\besc\b|sanitize|purify|DOMPurify/i;

export const BUG_RULES: BugRule[] = [
  // ── JavaScript / TypeScript ──
  {
    id: "async-foreach",
    kinds: ["js"],
    severity: "medium",
    confidence: "likely",
    category: "async",
    title: "forEach doesn't wait for the async work inside it",
    why: "forEach ignores the promise each async callback returns. The code after the loop runs before the work is finished, and an error inside is never caught.",
    fix: "Use a for…of loop with await inside to go one by one — or await Promise.all(items.map(async (item) => …)) to run them all together.",
    learn: "async / await",
    practice: "practice",
    find: (f) => each(f, /\.forEach\(\s*async\b/),
  },
  {
    id: "async-useeffect",
    kinds: ["js"],
    severity: "medium",
    confidence: "likely",
    category: "async",
    title: "useEffect is given an async function",
    why: "React expects an effect to return nothing or a clean-up function. An async function returns a promise instead, so the clean-up never runs and errors get lost.",
    fix: "Keep the effect itself normal and call an async function inside it: useEffect(() => { const load = async () => { … }; load(); }, [deps]).",
    learn: "React effects",
    practice: "practice",
    find: (f) => each(f, /\buseEffect\(\s*async\b/),
  },
  {
    id: "missing-await",
    kinds: ["js"],
    severity: "medium",
    confidence: "likely",
    category: "async",
    title: "A request isn't awaited (fetch / axios without await)",
    why: "fetch() and axios return a Promise — a placeholder for an answer that hasn't arrived yet. Reading .json() or .data from it straight away gives an error or undefined.",
    fix: "Put await in front of the call (inside an async function): const res = await fetch(url).",
    learn: "Promises & async / await",
    practice: "practice",
    find: (f) =>
      each(f, /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:fetch|axios(?:\.(?:get|post|put|patch|delete|request))?)\s*\(/, (i, m) => {
        const v = escRe(m[1]);
        const stmt = callText(f.code, i, m.index, 8);
        if (/\.(then|catch)\s*\(/.test(stmt) || /^\s*\./.test(f.code[i + 1] ?? "")) return false;
        const after = f.code.slice(i + 1, i + 25).join("\n");
        if (new RegExp(`\\bawait\\s+${v}\\b|\\b${v}\\.then\\(|Promise\\.(all|race|allSettled|any)\\(|\\breturn\\s+${v}\\b`).test(after)) return false;
        return new RegExp(`(?<![\\w$.])${v}\\.(json|text|blob|data|ok|status|headers)\\b`).test(after);
      }),
  },
  {
    id: "nan-compare",
    kinds: ["js", "py"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "Comparing with NaN is always false",
    why: "NaN (\"not a number\") is not equal to anything — not even to itself. So x === NaN is false every time and the check never fires.",
    fix: "Use Number.isNaN(x) in JavaScript, or math.isnan(x) in Python.",
    learn: "Comparisons",
    practice: "factory",
    find: (f) =>
      f.kind === "py"
        ? each(f, /[!=]=\s*(math|np|numpy)\.nan\b|\b(math|np|numpy)\.nan\s*[!=]=|[!=]=\s*float\(\s*["']xxx["']\s*\)/, (i) => /float\(\s*["']nan["']\s*\)|\.nan\b/i.test(f.raw[i]))
        : each(f, /[!=]==?\s*NaN\b|\bNaN\s*[!=]==?/),
  },
  {
    id: "getmonth-display",
    kinds: ["js"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "The month is shown one too low (getMonth starts at 0)",
    why: "In JavaScript, getMonth() counts from 0: January is 0 and December is 11. Printing it directly shows March as 2. A classic off-by-one bug.",
    fix: "Add 1 when you show it — date.getMonth() + 1 — or let toLocaleDateString() format the whole date for you.",
    learn: "Off-by-one errors",
    practice: "factory",
    find: (f) =>
      each(f, /getMonth\(\)/, (i) => {
        const l = f.code[i];
        for (const m of l.matchAll(/getMonth\(\)/g)) {
          const before = l.slice(0, m.index);
          const after = l.slice(m.index + m[0].length);
          if (/^\s*\+\s*1\b/.test(after) || /^\s*\]/.test(after)) continue;
          const inTpl = /\$\{[^}]*$/.test(before);
          const concat = /["'`]\s*\+\s*[\w$.()]*$/.test(before) || /^\s*\+\s*["'`]/.test(after) || /String\(\s*[\w$.]*$/.test(before) || /^\s*\)?\s*\.(toString|padStart)\(/.test(after);
          if (inTpl || concat) return true;
        }
        return false;
      }),
  },
  {
    id: "state-mutation",
    kinds: ["js"],
    severity: "medium",
    confidence: "likely",
    category: "data",
    title: "React state is changed in place",
    why: "React only re-renders when you give it a NEW array or object. .sort(), .push() and .splice() change the old one in place, so the screen may not update — and the old value is changed behind React's back.",
    fix: "Copy first, then change the copy: setItems([...items].sort(compare)) or setItems([...items, newItem]). Newer JavaScript also has items.toSorted().",
    learn: "React state",
    practice: "factory",
    find: (f) => {
      const text = f.raw.join("\n");
      const names = uniq([...text.matchAll(/\bconst\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*set[A-Z][\w$]*\s*\]\s*=\s*(?:React\.)?useState\b/g)].map((m) => m[1]));
      if (!names.length) return [];
      const re = new RegExp(`(?<![\\w$.])(${names.map(escRe).join("|")})\\.(sort|reverse|push|pop|shift|unshift|splice)\\(`);
      return each(f, re, (_i, m) => ({ line: 0, title: `React state "${m[1]}" is changed in place with .${m[2]}()` }));
    },
  },
  {
    id: "inner-html",
    kinds: ["js"],
    severity: "high",
    confidence: "possible",
    category: "security",
    title: "Text is inserted as HTML (innerHTML) — XSS risk",
    why: "If any part of that text comes from a user (a name, a comment, the URL), they can sneak in a <script> or an <img onerror=…> that runs in other people's browsers. That's called cross-site scripting (XSS).",
    fix: "Use textContent for plain text, or build elements with document.createElement. If you really need HTML, clean it first with a sanitizer like DOMPurify.",
    learn: "Cross-site scripting (XSS)",
    practice: "bounty",
    find: (f) =>
      each(f, /\.(innerHTML|outerHTML)\s*\+?=(?!=)|\.insertAdjacentHTML\(/, (i, m) => {
        const raw = f.raw[i];
        let rhs = m[0].startsWith(".insert") ? raw.slice(m.index + m[0].length).replace(/^\s*["'`][^"'`]*["'`]\s*,/, "") : raw.slice(m.index + m[0].length);
        rhs = rhs.trim() || (f.raw[i + 1] ?? "").trim();
        if (!rhs || /^(["'])(?:(?!\1).)*\1\s*\)?;?$/.test(rhs) || /^`[^`$]*`\s*\)?;?$/.test(rhs) || SAFE_HTML_FN.test(rhs)) return false;
        // outside data (an API answer, a form field, the URL) → likely; text built with ${…} or + → possible;
        // a bare counter or local value (times.innerHTML = ++n) → not flagged
        if (/\.value\b|location\.|params|query|search|\.hash\b|input|message|comment|\.body\b|response|\bres\b|\bdata\b|json|\.text\b/i.test(rhs)) return { line: 0, confidence: "likely" };
        if (/\$\{/.test(rhs) || /["'`]\s*\+|\+\s*["'`]/.test(rhs) || /html|name|title|content|user|post/i.test(rhs)) return { line: 0, confidence: "possible" };
        return false;
      }),
  },
  {
    id: "dangerous-html",
    kinds: ["js"],
    severity: "medium",
    confidence: "possible",
    category: "security",
    title: "dangerouslySetInnerHTML renders data as raw HTML",
    why: "React normally escapes text so it can't run as code. dangerouslySetInnerHTML turns that off — if the HTML can contain anything a user typed, it can run scripts in other users' browsers (XSS).",
    fix: "Render the text normally ({value}) — or, if it must be HTML (e.g. from Markdown), clean it with DOMPurify.sanitize() first.",
    learn: "Cross-site scripting (XSS)",
    practice: "bounty",
    find: (f) =>
      each(f, /dangerouslySetInnerHTML\s*=/, (i) => {
        const chunk = f.raw.slice(i, i + 4).join(" ");
        const v = chunk.match(/__html\s*:\s*([^}]*)\}/)?.[1]?.trim() ?? "";
        // a literal, a constant, JSON-LD, or the output of an escaping / highlighting / sanitising helper is not flagged
        if (!v || /^(["'])(?:(?!\1).)*\1$/.test(v) || /^`[^`$]*`$/.test(v) || SAFE_HTML_FN.test(v) || /JSON\.stringify/.test(v) || /^[A-Z0-9_]+$/.test(v)) return false;
        return true;
      }),
  },
  {
    id: "blank-no-rel",
    kinds: ["js"],
    severity: "low",
    confidence: "likely",
    category: "security",
    title: 'A link opens a new tab without rel="noopener noreferrer"',
    why: 'A page opened with target="_blank" can get a handle to your tab (window.opener) and quietly send it to a fake login page — "tab-nabbing". Modern browsers block most of it, older ones don\'t, and the address of your page still leaks.',
    fix: 'Add rel="noopener noreferrer" to every link that uses target="_blank".',
    learn: "Safe links",
    practice: "bounty",
    find: (f) =>
      each(f, /\btarget\s*=\s*\{?\s*["']xxxxxx["']/, (i) => {
        const idx = f.raw[i].search(/\btarget\s*=/);
        if (!/target\s*=\s*\{?\s*["']_blank["']/.test(f.raw[i])) return false;
        const before = f.raw.slice(Math.max(0, i - 8), i).join("\n") + "\n" + f.raw[i].slice(0, idx);
        const after = f.raw[i].slice(idx) + "\n" + f.raw.slice(i + 1, i + 9).join("\n");
        const open = before.lastIndexOf("<");
        if (open < 0) return false;
        const head = before.slice(open);
        if (!/^<(a|Link)\b/.test(head)) return false;
        const close = after.search(/(?<![=>])>/);
        const tag = head + (close >= 0 ? after.slice(0, close) : after);
        return !/\brel\s*=/.test(tag) && !/\bhref\s*=\s*\{?\s*["'`](\/(?!\/)|#|\.|mailto:)/.test(tag);
      }),
  },
  {
    id: "weak-random-token",
    kinds: ["js", "py"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "A token or password is made with a predictable random function",
    why: "Math.random() (and Python's random module) are made for games, not security: their numbers can be predicted, so an attacker can guess the OTP, reset link or token.",
    fix: 'Use a cryptographic generator: crypto.randomUUID() or crypto.randomBytes(32).toString("hex") in Node, crypto.getRandomValues() in the browser, secrets.token_urlsafe() in Python.',
    learn: "Secure randomness",
    practice: "bounty",
    find: (f) => {
      const rnd = f.kind === "py" ? /(?<![\w.])random\.(randint|random|choice|choices|randrange|sample|getrandbits)\(/ : /\bMath\.random\(\)/;
      const header = f.kind === "py" ? /^\s*(async\s+)?def\s+(\w+)/ : /(?:function\s+|(?:const|let|var)\s+)([\w$]+)/;
      return each(f, rnd, (i) => {
        const l = f.code[i];
        const assigned = l.match(/([\w$]+)\s*[:=]\s*[^=]/)?.[1] ?? "";
        if (assigned && secretishName(assigned)) return true;
        if (assigned && !/^\s*(return|yield)\b/.test(l)) return false; // assigned to an ordinary name
        for (let j = i; j >= Math.max(0, i - 6); j--) {
          const h = f.code[j].match(header);
          if (h) return secretishName(h[h.length - 1]);
        }
        return false;
      });
    },
  },
  {
    id: "weak-hash",
    kinds: ["js", "py"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "A password or token is hashed with MD5 / SHA-1",
    why: "MD5 and SHA-1 are fast and broken: attackers can try billions of guesses a second against a stolen database, and look common passwords up in ready-made tables.",
    fix: "Hash passwords with bcrypt, scrypt or argon2 — they're slow on purpose and add a salt. For tokens or signatures, use SHA-256 inside an HMAC.",
    learn: "Password hashing",
    practice: "bounty",
    find: (f) =>
      each(f, f.kind === "py" ? /\bhashlib\.(md5|sha1)\(|\bhashlib\.new\(/ : /\bcreateHash\(/, (i) => {
        if (f.kind === "js" && !/createHash\(\s*["'](md5|sha1)["']/i.test(f.raw[i])) return false;
        if (f.kind === "py" && /hashlib\.new\(/.test(f.code[i]) && !/hashlib\.new\(\s*["'](md5|sha1)["']/i.test(f.raw[i])) return false;
        const ctx = f.raw.slice(Math.max(0, i - 4), i + 5).join("\n");
        return /passw|pwd|secret|token|signature|session|salt|credential/i.test(ctx);
      }),
  },
  {
    id: "jwt-decode",
    kinds: ["js", "py"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "A login token is read without checking its signature (jwt.decode)",
    why: 'jwt.decode only reads what\'s inside the token — it doesn\'t check the signature. Anyone can write a token that says "I\'m the admin", and the code will believe it.',
    fix: 'Use jwt.verify(token, secret) in Node, or jwt.decode(token, key, algorithms=["HS256"]) with verification on in Python — and reject the request if it fails.',
    learn: "JSON Web Tokens",
    practice: "bounty",
    find: (f) => {
      if (f.kind === "js") return f.code.some((l) => /\bjwt\.verify\(/.test(l)) ? [] : each(f, /\bjwt\.decode\(/);
      return each(f, /\bjwt\.decode\(/, (i, m) => {
        const raw = f.raw.slice(i, i + 6).join("\n").slice(m.index);
        return /verify_signature["']?\s*:\s*False|\bverify\s*=\s*False/.test(raw);
      });
    },
  },
  {
    id: "plaintext-password",
    kinds: ["js", "py"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "Passwords are compared as plain text",
    why: "If a password can be compared directly, it's stored as plain text — one database leak exposes every user's password (and people reuse them everywhere).",
    fix: "Store only a hash: bcrypt.hash(password, 12) when someone signs up, and bcrypt.compare(input, user.passwordHash) when they log in (Python: bcrypt.checkpw or passlib).",
    learn: "Password hashing",
    practice: "bounty",
    find: (f) =>
      each(f, PW_CMP, (_i, m) => {
        const sides = [m[1], m[2]];
        if (sides.some((x) => /confirm|repeat|retype|again|verify|new|old|hash|length|placeholder|type|show|visible|valid|strength|min|max|policy|regex|error|field|label|input\b/i.test(x))) return false;
        return sides.some((x) => x.includes("."));
      }),
  },
  {
    id: "error-leak",
    kinds: ["js", "py"],
    severity: "medium",
    confidence: "likely",
    category: "security",
    title: "Error details are sent back to the user",
    why: "Raw error objects and stack traces reveal file paths, library versions and sometimes SQL or secrets — a free map for an attacker, and confusing for users.",
    fix: 'Log the full error on the server (console.error / a logger) and send a short, friendly message instead: res.status(500).json({ error: "Something went wrong" }).',
    learn: "Error handling",
    practice: "bounty",
    find: (f) =>
      f.kind === "py"
        ? each(f, /\breturn\b.*\btraceback\.format_exc\(\)|jsonify\([^)]*traceback\./)
        : each(f, /\bres(?:\.status\(\s*\d+\s*\))?\.(?:send|json)\(\s*(?:err|error|e|ex|exception)(?:\.stack)?\s*\)|\.(?:send|json)\(\s*\{[^}]*:\s*(?:err|error|e)\.stack\b/, (i) =>
            f.code.slice(Math.max(0, i - 8), i + 1).some((l) => /\bcatch\b|\(\s*(err|error|e)\s*[,)]|function\s*\(\s*(err|error)/.test(l)),
          ),
  },
  {
    id: "json-parse-unguarded",
    kinds: ["js", "py"],
    severity: "medium",
    confidence: "likely",
    category: "crash",
    title: "Parsing JSON from outside can crash",
    why: "JSON.parse (json.loads in Python) throws an error if the text isn't valid JSON — an old value in localStorage, a half-sent request, someone editing the URL. With no try/catch, that one bad value crashes the page or the request.",
    fix: "Wrap it: try { data = JSON.parse(text) } catch { data = fallback } — and check the parsed value has the shape you expect.",
    learn: "Parsing untrusted input",
    practice: "practice",
    find: (f) =>
      f.kind === "py"
        ? each(f, /\bjson\.loads\(\s*(?:request\.(?:data|body|get_data\(\))|self\.request\.body)/, (i) => !pyInTry(f.code, i))
        : each(
            f,
            /JSON\.parse\(\s*(?:await\s+)?(?:(?:window\.)?(?:localStorage|sessionStorage)\.getItem\(|(?:req|request|event|evt|e|msg|message|ev)\.(?:body|data|query|params)\b|(?:req|request)\.text\(\)|document\.cookie|(?:[\w$.]+\.)?(?:searchParams|query|params)\.get\()/,
            (i, m) =>
              jsInTry(f.code, i, m.index)
                ? false
                : // the app's own saved data only breaks when it's corrupted; a request or the URL can be anything
                  /Storage\.getItem\(/.test(m[0])
                  ? { line: 0, severity: "low", confidence: "possible" }
                  : true,
          ),
  },
  {
    id: "var-loop-closure",
    kinds: ["js"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "Callbacks in a for (var …) loop all see the last value",
    why: "var is shared by the whole function — it isn't created fresh for each turn of the loop. Every callback made inside the loop sees the FINAL value of the counter, not the one from its own turn.",
    fix: "Change var to let: for (let i = 0; …). let gives every turn of the loop its own copy.",
    learn: "Closures & scope",
    practice: "factory",
    find: (f) =>
      each(f, /\bfor\s*\(\s*var\s+([A-Za-z_$][\w$]*)/, (i, m) => {
        const body = cBlock(f.code, i);
        const cb = body.search(/setTimeout\(|setInterval\(|addEventListener\(|=>|function\s*\(|\.then\(/);
        return cb >= 0 && new RegExp(`\\b${escRe(m[1])}\\b`).test(body.slice(cb));
      }),
  },
  {
    id: "index-at-length",
    kinds: ["js", "py"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "Reading one past the end of a list (index = length)",
    why: "Positions start at 0, so the last item is at length − 1. Index length is one past the end: JavaScript gives undefined, Python raises IndexError.",
    fix: "Use length − 1 for the last item — or items.at(-1) in JavaScript and items[-1] in Python.",
    learn: "Off-by-one errors",
    practice: "factory",
    find: (f) =>
      f.kind === "py" ? each(f, /([A-Za-z_]\w*(?:\.\w+)*)\[\s*len\(\s*\1\s*\)\s*\]/) : each(f, /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\[\s*\1\.length\s*\](?!\s*=(?!=))/),
  },
  {
    id: "loop-past-end",
    kinds: ["js", "py"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "The loop runs one step too far",
    why: "The last valid position is length − 1, but this loop also visits position length — one past the end. JavaScript reads undefined there; Python stops with IndexError.",
    fix: "Use i < items.length (or range(len(items)) in Python) — or loop over the items themselves with for…of / for item in items.",
    learn: "Off-by-one errors",
    practice: "factory",
    find: (f) =>
      f.kind === "py"
        ? each(f, /\bfor\s+(\w+)\s+in\s+range\(\s*(?:0\s*,\s*)?len\(\s*([\w.]+)\s*\)\s*\+\s*1\s*\)/, (i, m) =>
            new RegExp(`${escRe(m[2])}\\[\\s*${escRe(m[1])}\\s*\\]`).test(pyBlock(f.code, i).map((j) => f.code[j]).join("\n")),
          )
        : each(f, /\bfor\s*\(\s*(?:let|var|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*0\s*;\s*\1\s*<=\s*([A-Za-z_$][\w$.]*?)\.length\s*;/, (i, m) =>
            new RegExp(`${escRe(m[2])}\\[\\s*${escRe(m[1])}\\s*\\]`).test(cBlock(f.code, i)),
          ),
  },
  {
    id: "loop-skips-last",
    kinds: ["js", "py"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "The loop stops one item early (the last item is skipped)",
    why: "range(len(items) - 1) — like i < items.length - 1 — stops BEFORE the last position, so the last item is never looked at. This is the classic off-by-one bug.",
    fix: "Loop over every position with range(len(items)) / i < items.length — or simply for item in items. Only use - 1 when you compare each item with the next one.",
    learn: "Off-by-one errors",
    practice: "factory",
    find: (f) => {
      const check = (body: string, after: string, arr: string, i: string) =>
        new RegExp(`${escRe(arr)}\\[\\s*${escRe(i)}\\s*\\]`).test(body) &&
        !new RegExp(`\\b${escRe(i)}\\s*\\+\\s*1\\b|\\b${escRe(i)}\\s*\\+=`).test(body) &&
        !new RegExp(`${escRe(arr)}\\[\\s*(-1|len\\(\\s*${escRe(arr)}\\s*\\)\\s*-\\s*1|${escRe(arr)}\\.length\\s*-\\s*1)\\s*\\]|${escRe(arr)}\\.at\\(\\s*-1\\s*\\)`).test(after);
      if (f.kind === "py")
        return each(f, /\bfor\s+(\w+)\s+in\s+range\(\s*(?:0\s*,\s*)?len\(\s*([\w.]+)\s*\)\s*-\s*1\s*\)/, (i, m) => {
          const body = pyBlock(f.code, i);
          const end = body.length ? body[body.length - 1] : i;
          return check(body.map((j) => f.code[j]).join("\n"), f.code.slice(end + 1, end + 8).join("\n"), m[2], m[1]);
        });
      return each(f, /\bfor\s*\(\s*(?:let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*0\s*;\s*\1\s*<\s*([A-Za-z_$][\w$.]*?)\.length\s*-\s*1\s*;/, (i, m) => {
        const body = cBlock(f.code, i);
        const end = i + body.split("\n").length;
        return check(body.split("\n").slice(1).join("\n") || body, f.code.slice(end, end + 8).join("\n"), m[2], m[1]);
      });
    },
  },
  {
    id: "assign-in-condition",
    kinds: ["js", "java"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "= (assign) is used where === (compare) was meant",
    why: "if (x = 5) doesn't compare anything — it SETS x to 5, and then the if is true whenever 5 is truthy. The condition ends up the same every time.",
    fix: "Use === to compare in JavaScript (== in Java): if (x === 5).",
    learn: "Comparisons",
    practice: "factory",
    find: (f) => each(f, /\bif\s*\(\s*[A-Za-z_$][\w$.]*(?:\[[^\]]*\])?\s*=[^=>]/),
  },
  // ── Python ──
  {
    id: "mutable-default",
    kinds: ["py"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "A list or dict is used as a default argument",
    why: "Python creates the default list/dict ONCE, when the function is defined — not on every call. Anything added to it stays, so the next call starts with leftovers from the last one.",
    fix: "Default to None and make a fresh one inside: def add(item, items=None): then if items is None: items = [].",
    learn: "Mutable default arguments",
    practice: "factory",
    find: (f) => {
      const out: Hit[] = [];
      f.code.forEach((l, i) => {
        if (!/^\s*(async\s+)?def\s+\w+\s*\(/.test(l)) return;
        let sig = "";
        let last = i;
        for (let j = i; j < Math.min(f.code.length, i + 10); j++) {
          sig += f.code[j] + "\n";
          last = j;
          if (/\)\s*(->[^:]*)?:\s*$/.test(f.code[j])) break;
        }
        const m = sig.match(/(?:^|[(,])\s*\*{0,2}([A-Za-z_]\w*)\s*(?::[^=\n]*?)?=\s*(\[|\{|(?:set|dict|list)\(\s*\)|defaultdict\()/m);
        if (!m) return;
        // only a bug when the shared default can change: the function mutates it, keeps it, or hands it back
        const name = escRe(m[1]);
        const defIndent = indentOf(l);
        const bodyLines: string[] = [];
        for (let j = last + 1; j < Math.min(f.code.length, last + 300); j++) {
          if (!f.code[j].trim()) continue;
          if (indentOf(f.code[j]) <= defIndent) break;
          bodyLines.push(f.code[j]);
        }
        const body = bodyLines.join("\n");
        const changes = new RegExp(
          `\\b${name}\\s*\\.\\s*(append|extend|insert|pop|remove|clear|sort|reverse|update|setdefault|add|discard|popitem)\\(|\\b${name}\\s*\\[[^\\]]*\\]\\s*(=(?!=)|\\+=|-=)|\\b${name}\\s*(\\+=|\\|=)|=\\s*${name}\\s*$|\\breturn\\s+${name}\\b|\\bdel\\s+${name}\\[`,
          "m",
        );
        if (!changes.test(body)) return;
        let at = i;
        for (let j = i; j <= last; j++) if (new RegExp(`\\b${escRe(m[1])}\\b[^=]*=\\s*(\\[|\\{|set\\(|dict\\(|list\\(|defaultdict\\()`).test(f.code[j])) {
          at = j;
          break;
        }
        out.push({ line: at + 1, title: `"${m[1]}" has a list/dict as its default value` });
      });
      return out;
    },
  },
  {
    id: "is-literal",
    kinds: ["py"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: '"is" is used to compare with a value',
    why: 'is checks whether two things are the very same object in memory, not whether they are equal. x is 1000 or name is "admin" can be False even when the values match (Python even warns about it).',
    fix: "Use == to compare values. Keep is only for None, True and False.",
    learn: "Identity vs equality",
    practice: "factory",
    find: (f) => each(f, /\bis\s+(?:not\s+)?(?:-?\d|["'])/),
  },
  {
    id: "shadow-builtin",
    kinds: ["py"],
    severity: "medium",
    confidence: "likely",
    category: "crash",
    title: "A variable hides one of Python's built-in functions",
    why: "After list = … (or sum, max, id, input…), that name points to your value, so a later list(…) call fails with \"TypeError: 'list' object is not callable\".",
    fix: "Rename the variable (items, total, user_id…) so the built-in still works.",
    learn: "Python built-ins",
    practice: "practice",
    find: (f) =>
      each(f, new RegExp(`^(\\s*)(?:for\\s+)?(${PY_BUILTINS})\\s*(?::[^=]+)?(?:=(?!=)|\\s+in\\b)`), (i, m) => {
        const name = m[2];
        const ind = m[1].length;
        let end = f.code.length;
        if (ind > 0)
          for (let j = i + 1; j < f.code.length; j++)
            if (f.code[j].trim() && indentOf(f.code[j]) < ind) {
              end = j;
              break;
            }
        const call = new RegExp(`(?<![\\w.])${name}\\(`);
        for (let j = i + 1; j < end; j++) if (call.test(f.code[j])) return { line: 0, title: `"${name}" hides Python's built-in ${name}()`, why: `After ${name} = …, the name ${name} points to your value — so the ${name}(…) call on line ${j + 1} fails with "TypeError: object is not callable".` };
        return false;
      }),
  },
  {
    id: "requests-no-timeout",
    kinds: ["py"],
    severity: "medium",
    confidence: "likely",
    category: "performance",
    title: "A web request has no timeout",
    why: "requests waits forever by default. If the other server hangs, your program (or one of your server's workers) hangs with it — and enough of them freeze the whole app.",
    fix: "Always pass a timeout in seconds: requests.get(url, timeout=10).",
    learn: "Timeouts",
    practice: "practice",
    find: (f) => each(f, /\brequests\.(?:get|post|put|patch|delete|head|options|request)\(/, (i, m) => !/\btimeout\s*=/.test(callText(f.code, i, m.index))),
  },
  {
    id: "tls-verify-off",
    kinds: ["py", "js"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "HTTPS certificate checks are turned off",
    why: "verify=False (or rejectUnauthorized: false) accepts ANY certificate, so anyone on the same Wi-Fi can pretend to be the server and read or change the traffic.",
    fix: "Remove it. If the server uses a self-signed certificate, point verify= (or the ca option) at that certificate file instead.",
    learn: "HTTPS & certificates",
    practice: "bounty",
    find: (f) => (f.kind === "py" ? each(f, /\bverify\s*=\s*False\b/, (i) => /requests|httpx|session|urlopen|aiohttp/i.test(f.code.slice(Math.max(0, i - 3), i + 1).join(" "))) : each(f, /\brejectUnauthorized\s*:\s*false\b|NODE_TLS_REJECT_UNAUTHORIZED\s*=/)),
  },
  {
    id: "shell-injection",
    kinds: ["py", "js"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "A shell command is built from text",
    why: "The whole string is run by the shell. If any part of it comes from a user, they can add ; rm -rf ~ or && curl … and run commands of their own. This is called command injection.",
    fix: 'Pass the program and its arguments as a list, without a shell: subprocess.run(["convert", filename, "out.png"]) or execFile("convert", [filename]). Never glue user input into a command string.',
    learn: "Command injection",
    practice: "bounty",
    find: (f) => {
      if (f.kind === "js") {
        if (!f.raw.some((l) => /child_process/.test(l))) return [];
        return each(f, /(?<![\w.])(?:exec|execSync)\(\s*(?:`|["'][^"']*["']\s*\+)/, (i, m) => /`[^`]*\$\{/.test(f.raw[i].slice(m.index)) || /\+/.test(f.code[i].slice(m.index)));
      }
      return each(f, /\bsubprocess\.(?:run|call|Popen|check_output|check_call)\(|\bos\.system\(|\bos\.popen\(/, (i, m) => {
        const call = callText(f.raw, i, m.index);
        const isOs = /^os\./.test(m[0]);
        if (!isOs && !/shell\s*=\s*True/.test(call)) return false;
        const arg = call.replace(/^[^(]*\(\s*/, "");
        if (/^[rbu]?f["']/i.test(arg) || /^["'][^"']*["']\s*(%|\+|\.format\()/.test(arg)) return true;
        if (/^["'][^"']*["']\s*[,)]/.test(arg)) return false;
        return { line: 0, severity: "medium", confidence: "possible" };
      });
    },
  },
  {
    id: "yaml-load",
    kinds: ["py"],
    severity: "high",
    confidence: "likely",
    category: "security",
    title: "yaml.load can run code hidden in the file",
    why: "Old versions of PyYAML's yaml.load build any Python object a file asks for — including ones that run commands. Newer versions refuse to run without a Loader, so this line crashes instead.",
    fix: "Use yaml.safe_load(f) — it only reads plain data (lists, dicts, strings, numbers).",
    learn: "Safe deserialisation",
    practice: "bounty",
    find: (f) => each(f, /\byaml\.(?:load|load_all)\(/, (i, m) => !/Loader\s*=|SafeLoader|CSafeLoader|BaseLoader/.test(callText(f.code, i, m.index))),
  },
  {
    id: "pickle-untrusted",
    kinds: ["py"],
    severity: "medium",
    confidence: "possible",
    category: "security",
    title: "pickle.load is used on data from outside",
    why: "Unpickling runs code chosen by whoever made the data. Loading pickles that come from users, uploads or the network lets them run anything on your server.",
    fix: "Use JSON for data you receive. Only unpickle files you created yourself and keep them where users can't change them.",
    learn: "Safe deserialisation",
    practice: "bounty",
    find: (f) => each(f, /\bpickle\.loads?\(/, (i) => /request|\.content\b|recv\(|upload|body|socket|redis|cookie|b64decode|base64/i.test(f.raw[i])),
  },
  {
    id: "divide-by-length",
    kinds: ["py", "js"],
    severity: "medium",
    confidence: "possible",
    category: "crash",
    title: "Dividing by the length fails on an empty list",
    why: "If the list is empty its length is 0: Python stops with ZeroDivisionError, JavaScript quietly gives NaN or Infinity. Empty input is the edge case beginners forget most.",
    fix: "Handle the empty case first: if not items: return 0 (Python) / if (items.length === 0) return 0 (JavaScript) — then divide.",
    learn: "Empty-input edge cases",
    practice: "factory",
    find: (f) => {
      const py = f.kind === "py";
      return each(f, py ? /\/\s*len\(\s*([\w.]+(?:\[[^\]]*\])?)\s*\)/ : /\/\s*([A-Za-z_$][\w$.]*)\.length\b/, (i, m) => {
        const x = escRe(m[1]);
        const before = f.code[i].slice(0, m.index);
        // inside the true branch of a ternary, the condition usually guards it
        if (/\?[^:]*$/.test(before)) return false;
        // only averages (sum / total / reduce ÷ length) — splitting a size by a count of settings isn't the bug
        if (!/reduce\(|\bsum\b|total|score|marks|points|amount|price|count|correct|grade|\bacc\b/i.test(before)) return false;
        let from = Math.max(0, i - 15);
        if (py) for (let j = i; j >= from; j--) if (/^\s*(async\s+)?def\b/.test(f.code[j])) {
          from = j;
          break;
        }
        const win = f.code.slice(from, i + 3).join("\n");
        const guard = py
          ? new RegExp(`\\bif\\s+(not\\s+)?(len\\(\\s*)?${x}\\b|len\\(\\s*${x}\\s*\\)\\s*(==|!=|>|>=|<|<=)\\s*\\d|\\bassert\\s+(len\\()?\\s*${x}|\\bor\\s+1\\b|\\bmax\\(|ZeroDivisionError|\\bif\\s+${x}\\s+else\\b|\\bwhile\\s+${x}\\b|\\bif\\s+len\\(`)
          : new RegExp(`${x}\\.length\\s*(===?|!==?|>|>=|<|<=)\\s*\\d|!\\s*${x}\\.length|${x}\\.length\\s*(\\?|&&)|\\|\\|\\s*1\\b|Math\\.max\\(|if\\s*\\(\\s*${x}\\.length\\s*\\)`);
        return !guard.test(win);
      });
    },
  },
  {
    id: "int-input",
    kinds: ["py"],
    severity: "low",
    confidence: "likely",
    category: "crash",
    title: "The program crashes if someone types a non-number",
    why: 'int(input()) raises ValueError the moment the user types "abc", "12.5" or just presses Enter — and the program stops.',
    fix: 'Wrap it in try / except ValueError and ask again, e.g. inside a while True loop: try: n = int(input("Age: ")); break — except ValueError: print("Please type a whole number").',
    learn: "Input validation",
    practice: "practice",
    find: (f) => each(f, /\b(?:int|float)\(\s*input\(/, (i) => !pyInTry(f.code, i)),
  },
  {
    id: "eq-none",
    kinds: ["py"],
    severity: "low",
    confidence: "possible",
    category: "logic",
    title: "Comparing with None using == instead of is",
    why: '== None usually works, but a class can change what == means (NumPy arrays and pandas columns compare element by element), so the check can misbehave. is None always means exactly "nothing".',
    fix: "Write if x is None: / if x is not None:",
    learn: "Identity vs equality",
    practice: "practice",
    find: (f) => each(f, /[!=]=\s*None\b|\bNone\s*[!=]=/),
  },
  {
    id: "float-equality",
    kinds: ["py", "js"],
    severity: "medium",
    confidence: "possible",
    category: "logic",
    title: "Decimal numbers are compared with ==",
    why: "Computers store most decimals approximately: 0.1 + 0.2 is 0.30000000000000004, so x == 0.3 can be False even when the maths says they're equal.",
    fix: "Compare with a small tolerance: math.isclose(a, b) in Python, Math.abs(a - b) < 1e-9 in JavaScript. For money, store whole cents as integers.",
    learn: "Floating-point numbers",
    practice: "factory",
    find: (f) =>
      each(f, /(?:[!=]==?)\s*(-?\d*\.\d+)\b(?!\.)|(?<![\w.])(\d*\.\d+)\s*[!=]==?/, (_i, m) => {
        const v = Number(m[1] ?? m[2]);
        return Number.isFinite(v) && !Number.isInteger(v * 1024);
      }),
  },
  {
    id: "open-without-with",
    kinds: ["py"],
    severity: "low",
    confidence: "likely",
    category: "performance",
    title: "A file is opened without with (it may never be closed)",
    why: "Files opened with open() stay open until .close() is called. If an error happens first — or it's forgotten — writes may never reach the disk and the program can run out of file handles.",
    fix: "Use with open(path) as f: … — Python closes the file for you, even when an error happens.",
    learn: "Files & context managers",
    practice: "practice",
    find: (f) =>
      each(f, /(?<![\w.])open\(/, (i) => {
        const l = f.code[i];
        if (/^\s*(async\s+)?with\b/.test(l) || /\.close\(\)/.test(l) || /^\s*def\s/.test(l)) return false;
        const v = l.match(/^\s*([\w.]+)\s*=\s*open\(/)?.[1];
        if (v && f.code.slice(i + 1, i + 60).some((x) => new RegExp(`\\b${escRe(v)}\\.close\\(\\)|with\\s+${escRe(v)}\\b|closing\\(\\s*${escRe(v)}`).test(x))) return false;
        return true;
      }),
  },
  // ── Java ──
  {
    id: "java-string-eq",
    kinds: ["java"],
    severity: "medium",
    confidence: "likely",
    category: "logic",
    title: "Strings are compared with == in Java",
    why: "In Java, == checks whether two String objects are the same object, not whether they hold the same text. Two equal strings read from input or a file are different objects, so == says false.",
    fix: 'Use "yes".equals(answer) (safe even when answer is null) or Objects.equals(a, b).',
    learn: "Java strings",
    practice: "factory",
    find: (f) => each(f, /[!=]=\s*"|"\s*[!=]=/),
  },
];

export const PRACTICE_LINK: Record<BugRule["practice"], { label: string; href: string }> = {
  factory: { label: "Practise this bug", href: "/bug-factory" },
  bounty: { label: "Hunt bugs like this", href: "/bounty" },
  practice: { label: "Practise debugging", href: "/practice" },
};
export const CONF_RANK = { likely: 0, possible: 1 } as const;

export function clip(l: string, n = 160): string {
  const t = l.replace(/\t/g, "  ").replace(/\s+$/, "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/** Up to 2 lines of context either side; any line that might hold a secret is replaced, never shown. */
export function snippetAt(raw: string[], line: number): RepoBug["snippet"] {
  const start = Math.max(1, line - 2);
  const end = Math.min(raw.length, line + 2);
  return { start, lines: raw.slice(start - 1, end).map((l) => (looksSecret(l) ? "… (line hidden — it looks like a secret)" : clip(l))) };
}

export function findBugs(s: RepoSnapshot): RepoBug[] {
  const groups: { rule: BugRule; file: string; hits: Hit[]; raw: string[] }[] = [];
  for (const [p, t] of Object.entries(s.contents)) {
    if (!isCode(p) || JUNK_DIR.test(p) || TEST_PATH.test(p) || PRACTICE_FILE.test(p) || NOT_PRODUCT.test(p)) continue;
    const kind: SrcKind | null = /\.py$/i.test(p) ? "py" : /\.java$/i.test(p) ? "java" : /\.(m?[jt]sx?|cjs|vue|svelte)$/i.test(p) ? "js" : null;
    if (!kind || t.length > 400_000) continue;
    const raw = t.split(/\r?\n/);
    if (raw.length > 8000 || t.length / Math.max(1, raw.length) > 250) continue; // minified / generated
    const f: SrcFile = { path: p, kind, raw, code: kind === "py" ? maskPy(raw) : maskCLike(raw, kind === "js") };
    for (const rule of BUG_RULES) {
      if (!rule.kinds.includes(kind)) continue;
      let hits: Hit[] = [];
      try {
        hits = rule.find(f);
      } catch {
        hits = [];
      }
      const seen = new Set<number>();
      hits = hits.filter((h) => h.line > 0 && !seen.has(h.line) && seen.add(h.line)).sort((a, b) => a.line - b.line);
      if (hits.length) groups.push({ rule, file: p, hits, raw });
    }
  }
  const sev = (g: (typeof groups)[number]) => SEV_RANK[g.hits[0].severity ?? g.rule.severity];
  const conf = (g: (typeof groups)[number]) => CONF_RANK[g.hits[0].confidence ?? g.rule.confidence];
  groups.sort((a, b) => sev(a) - sev(b) || conf(a) - conf(b) || BUG_RULES.indexOf(a.rule) - BUG_RULES.indexOf(b.rule) || a.file.localeCompare(b.file));

  const perRule = new Map<string, number>();
  const kept: (typeof groups)[number][] = [];
  const moreFiles = new Map<(typeof groups)[number], number>();
  for (const g of groups) {
    const n = perRule.get(g.rule.id) ?? 0;
    perRule.set(g.rule.id, n + 1);
    if (n < 4) kept.push(g);
    else {
      const last = [...kept].reverse().find((k) => k.rule.id === g.rule.id)!;
      moreFiles.set(last, (moreFiles.get(last) ?? 0) + 1);
    }
  }
  return kept.slice(0, 25).map((g) => {
    const h = g.hits[0];
    const others = g.hits.slice(1).map((x) => x.line);
    let why = h.why ?? g.rule.why;
    if (others.length) why += ` The same pattern is on ${others.length} more line${others.length === 1 ? "" : "s"} in this file (${others.slice(0, 4).join(", ")}${others.length > 4 ? ", …" : ""}).`;
    const more = moreFiles.get(g);
    if (more) why += ` It also shows up in ${more} more file${more === 1 ? "" : "s"}.`;
    return {
      id: `${g.rule.id}:${g.file}:${h.line}`,
      severity: h.severity ?? g.rule.severity,
      confidence: h.confidence ?? g.rule.confidence,
      category: g.rule.category,
      title: h.title ?? g.rule.title,
      file: g.file,
      line: h.line,
      snippet: snippetAt(g.raw, h.line),
      why,
      fix: g.rule.fix,
      learn: g.rule.learn,
      practice: PRACTICE_LINK[g.rule.practice],
    };
  });
}
