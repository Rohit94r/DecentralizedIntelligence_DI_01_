/**
 * Repo Analyse — the architecture & hygiene checks (security, structure,
 * testing, quality, docs, dependencies, devops, scalability), plus strengths
 * and the target architecture. Every check is a readable rule.
 */
import { type RepoFile, type RepoFinding, type RepoLayer, type RepoReport, type RepoSnapshot, SCRIPTISH, TEST_PATH, base, lineCount, packageJsons, scanSecrets, uniq } from "./repo-shared.ts";

export interface Ctx {
  s: RepoSnapshot;
  files: RepoFile[];
  code: RepoFile[];
  srcCode: [string, string][];
  tests: RepoFile[];
  deps: Set<string>;
  stack: string[];
  kind: string;
  layers: RepoLayer[];
  has: (re: RegExp) => boolean;
  grep: (re: RegExp, filter?: (p: string) => boolean) => { file: string; line: number }[];
}

export type Check = (x: Ctx) => RepoFinding | RepoFinding[] | null;

export const fileList = (hits: { file: string; line?: number }[], n = 4) => uniq(hits.map((h) => (h.line ? `${h.file}:${h.line}` : h.file))).slice(0, n);

export const CHECKS: Check[] = [
  // ── security ──
  (x) => {
    const envs = x.files.filter((f) => /(^|\/)\.env(\.[\w-]+)?$/.test(f.path) && !/\.(example|sample|template)$/.test(f.path));
    return envs.length
      ? {
          id: "env-committed",
          severity: "high",
          area: "security",
          title: "A secrets file (.env) is committed",
          why: "Anyone who can see the repo can read every password and API key in it — and git keeps it in history even after you delete it.",
          fix: "Delete the file from the repo, add .env to .gitignore, commit a .env.example with empty values instead, and change (rotate) every key that was in it.",
          learn: "Environment variables & secrets",
          files: envs.map((f) => f.path),
        }
      : null;
  },
  (x) => {
    const hits = scanSecrets(x.s.contents);
    return hits.length
      ? {
          id: "secret-in-code",
          severity: "high",
          area: "security",
          title: `Something that looks like a real secret is written in the code (${uniq(hits.map((h) => h.kind)).slice(0, 2).join(", ")})`,
          why: "Keys written into code get copied, shared and pushed to GitHub, where bots scan for them within minutes.",
          fix: "Move it into an environment variable (process.env / os.environ), load it from .env locally, and rotate the exposed key. We only show where it is, never the value.",
          learn: "Environment variables & secrets",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    // A VALUE spliced into SQL — after an operator or inside quotes ("= ${id}", "'${name}'", "LIKE '%${q}%'", "= " + id).
    // Composing clauses ("FROM t ${where}") while binding values with ? placeholders is fine and is not flagged.
    const VALUE_SLOT = /(=|<|>|\bLIKE|\bIN\s*\(|\bVALUES\s*\(|,)\s*'?%?$|'%?$/i;
    const js = x
      .grep(/`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{/i)
      .filter((h) => {
        const line = x.s.contents[h.file]?.split(/\r?\n/)[h.line - 1] ?? "";
        return [...line.matchAll(/\$\{/g)].some(
          (m) => VALUE_SLOT.test(line.slice(0, m.index).trimEnd()) || /^\$\{\s*(req|request|body|params|query|input|args)\b/.test(line.slice(m.index)),
        );
      });
    const concat = x.grep(/["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*(=|LIKE|IN \()\s*'?["']\s*\+\s*[A-Za-z_]/i);
    const py = x.grep(/\.execute\(\s*(f["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*(=|LIKE|IN \()\s*'?\{|["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*["']\s*(%|\+|\.format))/i);
    const hits = [...js, ...concat, ...py];
    return hits.length
      ? {
          id: "sql-injection",
          severity: "high",
          area: "security",
          title: "SQL is built by gluing strings together",
          why: "If any part of that string comes from a user, they can type SQL of their own and read or delete your data. This is called SQL injection — one of the most common real-world attacks.",
          fix: "Use placeholders (? or $1 or %s) and pass the values separately, or use your ORM's query builder. The database then treats user input as data, never as commands.",
          learn: "SQL injection & parameterised queries",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const hits = x.grep(/(^|[^.\w"'`])(eval|exec)\s*\((?!\s*\))/, (p) => !SCRIPTISH.test(p) && !TEST_PATH.test(p));
    return hits.length
      ? {
          id: "eval",
          severity: "medium",
          area: "security",
          title: "Text is being run as code (eval / exec)",
          why: "eval and exec run whatever string they are given. If that string can ever contain user input, a user can run anything on your machine.",
          fix: "Replace it with a safer tool (JSON.parse, ast.literal_eval, a lookup table). If it's on purpose — like a sandbox — keep the input tightly locked down and document why.",
          learn: "Untrusted input",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const hits = [...x.grep(/\bdebug\s*=\s*True\b/), ...x.grep(/^\s*DEBUG\s*=\s*True\b/)].filter((h) => /\.py$/.test(h.file));
    return hits.length
      ? {
          id: "debug-on",
          severity: "medium",
          area: "security",
          title: "Debug mode is switched on in the code",
          why: "Debug pages show your code, settings and sometimes secrets to anyone who triggers an error.",
          fix: "Read debug from an environment variable that defaults to off, and only turn it on locally.",
          learn: "Configuration per environment",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const hits = x.grep(/origin\s*:\s*["'`]\*["'`]|Access-Control-Allow-Origin["'`]?\s*[,:]\s*["'`]\*|CORS_ALLOW_ALL_ORIGINS\s*=\s*True|allow_origins\s*=\s*\[\s*["']\*["']\s*\]/);
    return hits.length
      ? {
          id: "cors-star",
          severity: "low",
          area: "security",
          title: "Any website is allowed to call your API (CORS *)",
          why: "A wildcard lets every site on the internet send requests from your users' browsers.",
          fix: "List only the front-end addresses that should be allowed, read from config.",
          learn: "CORS",
          files: fileList(hits),
        }
      : null;
  },

  // ── dependencies / repo hygiene ──
  (x) => {
    const junk = x.files.filter((f) => /(^|\/)(node_modules|\.venv|venv|__pycache__)\//.test(f.path));
    const minor = x.files.filter((f) => /(^|\/)(\.DS_Store|Thumbs\.db)$|(^|\/)(dist|build|\.next|coverage)\//.test(f.path));
    const out: RepoFinding[] = [];
    if (junk.length)
      out.push({
        id: "deps-committed",
        severity: "high",
        area: "dependencies",
        title: "Installed packages are committed (node_modules / venv / __pycache__)",
        why: "They're thousands of generated files that make the repo huge and slow, and they break on other machines.",
        fix: "Delete them from git (git rm -r --cached <folder>), add the folder to .gitignore, and let people install with npm install / pip install.",
        learn: ".gitignore",
        files: uniq(junk.map((f) => f.path.split("/").slice(0, f.path.split("/").findIndex((s) => /node_modules|venv|__pycache__/.test(s)) + 1).join("/") + "/")).slice(0, 4),
      });
    if (minor.length)
      out.push({
        id: "build-committed",
        severity: "low",
        area: "dependencies",
        title: "Build output or system files are committed",
        why: "Generated files go stale and cause noisy, confusing diffs.",
        fix: "Add dist/, build/, .next/, coverage/ and .DS_Store to .gitignore and remove them from git.",
        learn: ".gitignore",
        files: uniq(minor.map((f) => f.path)).slice(0, 4),
      });
    if (!x.has(/(^|\/)\.gitignore$/))
      out.push({
        id: "no-gitignore",
        severity: "medium",
        area: "dependencies",
        title: "There is no .gitignore",
        why: "Without it, secrets, installed packages and build files end up committed by accident.",
        fix: "Add a .gitignore for your language (GitHub has ready-made templates) before your next commit.",
        learn: ".gitignore",
      });
    return out;
  },
  (x) => {
    if (!x.has(/(^|\/)package\.json$/)) return null;
    if (x.has(/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json)$/)) return null;
    return {
      id: "no-lockfile",
      severity: "medium",
      area: "dependencies",
      title: "No lockfile, so installs aren't repeatable",
      why: "Without package-lock.json (or yarn/pnpm lock), two people can install different versions and get bugs that 'only happen on my machine'.",
      fix: "Run npm install once and commit the package-lock.json it creates.",
      learn: "Dependency locking",
    };
  },
  (x) => {
    const req = Object.entries(x.s.contents).find(([p]) => /(^|\/)requirements\.txt$/.test(p));
    if (!req) return null;
    const lines = req[1].split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("-"));
    const loose = lines.filter((l) => !/[=<>~]=?/.test(l));
    return loose.length >= Math.max(2, lines.length / 2)
      ? {
          id: "unpinned-python",
          severity: "low",
          area: "dependencies",
          title: "Python packages have no versions pinned",
          why: "A future release of a package can break your project overnight, with no change on your side.",
          fix: "Pin versions (package==1.2.3) — pip freeze > requirements.txt is the quick way.",
          learn: "Dependency locking",
          files: [req[0]],
        }
      : null;
  },
  (x) => {
    const n = [...x.deps].filter((d) => !d.startsWith("py:")).length;
    return n > 70
      ? {
          id: "many-deps",
          severity: "low",
          area: "dependencies",
          title: `A lot of dependencies (${n})`,
          why: "Each package is code you didn't write but have to trust, update and ship.",
          fix: "Remove the ones you don't use (npx depcheck finds them) and prefer the platform's built-ins.",
          learn: "Dependency hygiene",
        }
      : null;
  },

  // ── testing ──
  (x) => {
    if (x.tests.length) return null;
    return {
      id: "no-tests",
      severity: "high",
      area: "testing",
      title: "There are no automated tests",
      why: "Without tests, every change is a guess — you only find out something broke when a user does.",
      fix: `Add a tests/ folder and write ONE test for your most important function today (${x.stack.includes("Python") ? "pytest" : x.stack.includes("TypeScript") || x.stack.includes("JavaScript") ? "Vitest or node:test" : "your language's test runner"}). Test what goes in and what comes out — exactly like Layerflow's visible and hidden tests.`,
      learn: "Unit testing",
    };
  },
  (x) => {
    if (!x.tests.length || x.code.length < 15) return null;
    const ratio = x.tests.length / x.code.length;
    return ratio < 0.08
      ? {
          id: "few-tests",
          severity: "medium",
          area: "testing",
          title: `Only ${x.tests.length} test file${x.tests.length === 1 ? "" : "s"} for ${x.code.length} code files`,
          why: "Most of the code is unchecked, so refactoring it for growth is risky.",
          fix: "Add tests for the logic layer first (services / core) — it's the easiest to test and the most expensive to get wrong. Include edge cases: empty input, one item, the boundary value.",
          learn: "Unit testing",
        }
      : null;
  },

  // ── structure ──
  (x) => {
    const big = x.srcCode
      .map(([p, t]) => ({ p, n: lineCount(t) }))
      .filter((f) => f.n > 600 && !/(^|\/)(data|fixtures?|generated|migrations?)\/|challenge-bank|\.data\./i.test(f.p))
      .sort((a, b) => b.n - a.n);
    return big.length
      ? {
          id: "god-files",
          severity: big[0].n > 1200 ? "high" : "medium",
          area: "structure",
          title: `${big.length} very large file${big.length === 1 ? "" : "s"} (biggest: ${big[0].n} lines)`,
          why: "A file that does many jobs is hard to read, hard to test and causes merge conflicts when a team works on it at the same time.",
          fix: "Split it by job: one file per feature or per layer (routes, services, data). A good rule of thumb is that a file should fit in your head — under ~300 lines.",
          learn: "Separation of concerns",
          files: big.slice(0, 4).map((b) => `${b.p} (${b.n} lines)`),
        }
      : null;
  },
  (x) => {
    const rootCode = x.code.filter((f) => !f.path.includes("/"));
    return rootCode.length >= 8
      ? {
          id: "flat-root",
          severity: "medium",
          area: "structure",
          title: `${rootCode.length} code files sit loose in the top folder`,
          why: "When everything is in one folder, nobody can tell which file is a page, which is a route and which is a helper.",
          fix: "Group files into folders by layer or feature, for example src/routes, src/services, src/db — then each folder has one job.",
          learn: "Project structure",
          files: rootCode.slice(0, 5).map((f) => f.path),
        }
      : null;
  },
  (x) => {
    const DB = /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\s|\.(query|execute|prepare)\(|\bprisma\.\w+\.|\bmongoose\.|\.find(One|ById)?\(\s*\{|\bcursor\.execute|\bsession\.query\(|\.collection\(["']|\bdb\.(prepare|query|exec|run|all|get)\(|\.objects\.(filter|get|all)\(/;
    const routeLike = /(^|\/)(routes?|api|controllers?|handlers?|endpoints?|pages|views)(\/|\.)|(^|\/)(server|app|index|main|urls|views)\.(py|[jt]sx?|mjs)$|route\.(t|j)s$/i;
    const hits = x.srcCode.filter(([p, t]) => routeLike.test(p) && !/(^|\/)(db|database|models?|repositor|store|dao)(\/|\.)/i.test(p) && DB.test(t)).map(([p]) => ({ file: p }));
    return hits.length
      ? {
          id: "routes-touch-db",
          severity: "medium",
          area: "structure",
          title: "Routes talk straight to the database",
          why: "When request-handling code also writes SQL, the rules of your app get copied into many places. Changing the database (or adding caching) means editing every route.",
          fix: "Add a data-access layer (a repository / store module) that is the ONLY code allowed to query the database. Routes call a service, the service calls the repository.",
          learn: "Layered architecture",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const api = x.layers.find((l) => l.id === "api")!;
    const logic = x.layers.find((l) => l.id === "logic")!;
    return api.present && !logic.present && x.code.length > 6
      ? {
          id: "no-service-layer",
          severity: "low",
          area: "structure",
          title: "No separate place for the app's rules (no services / core layer)",
          why: "The decisions your app makes live inside routes, so they can't be reused or tested on their own.",
          fix: "Create a services/ (or core/) folder with plain functions that take data and return data — no HTTP, no database. Routes become 3-line wrappers around them.",
          learn: "Layered architecture",
        }
      : null;
  },

  // ── quality ──
  (x) => {
    const hits = [
      ...x.grep(/catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/),
      ...x.grep(/^\s*except\s*:\s*(pass)?\s*$/).filter((h) => h.file.endsWith(".py")),
      ...x.grep(/^\s*except\s+Exception\s*(as\s+\w+)?\s*:\s*pass\s*$/),
    ];
    return hits.length >= 2
      ? {
          id: "swallowed-errors",
          severity: "medium",
          area: "quality",
          title: `Errors are silently swallowed (${hits.length} place${hits.length === 1 ? "" : "s"})`,
          why: "An empty catch / bare except hides the real problem, so bugs show up later somewhere else and are much harder to find.",
          fix: "Catch only the error you expect, and at least log it. If you can't handle it, let it bubble up to one central error handler.",
          learn: "Error handling",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const hits = x.grep(/\bconsole\.log\(|^\s*print\(/, (p) => !SCRIPTISH.test(p) && !TEST_PATH.test(p) && !/cli|main\.py$/.test(p));
    return hits.length >= 25
      ? {
          id: "debug-prints",
          severity: "low",
          area: "quality",
          title: `${hits.length} debug prints left in the code`,
          why: "Print-debugging is great while you work, but left behind it floods logs and can leak data.",
          fix: "Remove the temporary ones and use a small logger (with levels like info / warn / error) for the rest.",
          learn: "Logging",
          files: fileList(hits, 3),
        }
      : null;
  },
  (x) => {
    const hits = x.grep(/\b(TODO|FIXME|HACK|XXX)\b/);
    return hits.length >= 12
      ? {
          id: "todos",
          severity: "low",
          area: "quality",
          title: `${hits.length} TODO / FIXME notes`,
          why: "Each one is a known problem that isn't tracked anywhere a teammate would see it.",
          fix: "Turn the important ones into GitHub issues and delete the stale ones.",
          learn: "Technical debt",
        }
      : null;
  },
  (x) => {
    if (!x.stack.includes("TypeScript")) return null;
    const ts = Object.entries(x.s.contents).filter(([p]) => base(p) === "tsconfig.json");
    if (!ts.length) return null;
    const strict = ts.some(([, t]) => /"strict"\s*:\s*true/.test(t));
    return strict
      ? null
      : {
          id: "ts-not-strict",
          severity: "low",
          area: "quality",
          title: "TypeScript isn't in strict mode",
          why: "Without strict mode TypeScript lets many null and type mistakes through — the bugs it exists to catch.",
          fix: 'Set "strict": true in tsconfig.json and fix the errors it shows, one folder at a time.',
          learn: "Type safety",
          files: ts.map(([p]) => p),
        };
  },
  (x) => {
    const lint = x.has(/(^|\/)(\.eslintrc(\.\w+)?|eslint\.config\.\w+|\.prettierrc(\.\w+)?|prettier\.config\.\w+|biome\.jsonc?|\.flake8|ruff\.toml|\.ruff\.toml|\.pylintrc|setup\.cfg|\.editorconfig)$/);
    const inPy = Object.entries(x.s.contents).some(([p, t]) => /pyproject\.toml$/.test(p) && /\[tool\.(ruff|black|flake8|pylint|isort)/.test(t));
    const inPkg = packageJsons(x.s).some((p) => "eslintConfig" in p || "prettier" in p);
    return lint || inPy || inPkg || x.code.length < 5
      ? null
      : {
          id: "no-linter",
          severity: "low",
          area: "quality",
          title: "No linter or formatter set up",
          why: "A linter catches common bugs before you run the code, and a formatter ends arguments about style.",
          fix: x.stack.includes("Python") ? "Add ruff (one tool for linting + formatting) and run it before each commit." : "Add ESLint + Prettier (or Biome) and run them before each commit.",
          learn: "Linting",
        };
  },

  // ── docs ──
  (x) => {
    const readme = Object.entries(x.s.contents).find(([p]) => /^readme(\.\w+)?$/i.test(p));
    if (!x.has(/^readme(\.\w+)?$/i))
      return {
        id: "no-readme",
        severity: "high",
        area: "docs",
        title: "There is no README",
        why: "The README is the front door. Without it, nobody (including future you) knows what the project does or how to run it.",
        fix: "Add README.md with: what it does (one sentence), how to install, how to run, and how to run the tests.",
        learn: "Writing a README",
      };
    if (!readme) return null;
    const t = readme[1];
    if (t.replace(/\s+/g, " ").length < 400)
      return {
        id: "thin-readme",
        severity: "medium",
        area: "docs",
        title: "The README is very short",
        why: "A short README leaves newcomers guessing how to set things up.",
        fix: "Add sections: What it is · Setup · Run · Test · Project structure (a short tree of the main folders).",
        learn: "Writing a README",
        files: [readme[0]],
      };
    if (!/\b(install|npm (i|install|run|start)|pip install|yarn|pnpm|docker|getting started|setup|usage|how to run|quick ?start)\b/i.test(t))
      return {
        id: "readme-no-run",
        severity: "low",
        area: "docs",
        title: "The README doesn't say how to run it",
        why: "People give up within minutes if they can't start the project.",
        fix: "Add a 'Quick start' with the exact commands, copy-pasteable, in order.",
        learn: "Writing a README",
        files: [readme[0]],
      };
    return null;
  },
  (x) =>
    x.has(/(^|\/)(license|licence|copying)(\.\w+)?$/i)
      ? null
      : {
          id: "no-license",
          severity: "low",
          area: "docs",
          title: "No LICENSE file",
          why: "Without a licence, nobody is legally allowed to reuse your code — even if it's public.",
          fix: "Add a LICENSE (MIT is the simple, common choice for learning projects).",
          learn: "Open-source licences",
        },
  (x) => {
    const usesEnv = x.srcCode.some(([, t]) => /process\.env\.|os\.environ|os\.getenv|import\.meta\.env\.|System\.getenv|dotenv/.test(t));
    if (!usesEnv || x.has(/\.env\.(example|sample|template)$|(^|\/)env\.example$/)) return null;
    return {
      id: "no-env-example",
      severity: "medium",
      area: "docs",
      title: "The code reads settings from the environment, but there's no .env.example",
      why: "A newcomer can't run the project because nobody wrote down which settings (keys, URLs, ports) it needs.",
      fix: "Add .env.example listing every variable with an empty or fake value and a one-line comment for each.",
      learn: "Environment variables & secrets",
    };
  },

  // ── devops ──
  (x) =>
    x.has(/^\.github\/workflows\/|^\.gitlab-ci\.yml$|^\.circleci\/|azure-pipelines\.yml$|^Jenkinsfile$|^\.travis\.yml$/)
      ? null
      : {
          id: "no-ci",
          severity: "medium",
          area: "devops",
          title: "No CI — nothing checks each push automatically",
          why: "Without CI, a broken commit can sit on main for days before anyone notices.",
          fix: "Add .github/workflows/ci.yml that installs, lints and runs the tests on every push and pull request. It's about 20 lines.",
          learn: "Continuous integration",
        },
  (x) => {
    const service = /API|Full-stack|Monorepo/.test(x.kind);
    if (!service || x.has(/(^|\/)(dockerfile|docker-compose\.ya?ml|compose\.ya?ml|procfile|fly\.toml|render\.ya?ml|vercel\.json|netlify\.toml)$/i)) return null;
    return {
      id: "no-deploy",
      severity: "low",
      area: "devops",
      title: "No container or deploy config",
      why: "Without a Dockerfile (or a platform config) every deploy is done by hand, differently each time.",
      fix: "Add a small Dockerfile (or vercel.json / render.yaml) so the app starts the same way everywhere.",
      learn: "Containers",
    };
  },

  // ── scalability ──
  (x) => {
    const hits = x.grep(/\.listen\(\s*\d{2,5}\s*[,)]|app\.run\([^)]*port\s*=\s*\d{2,5}/, (p) => !TEST_PATH.test(p));
    return hits.length
      ? {
          id: "hardcoded-port",
          severity: "low",
          area: "scalability",
          title: "The port is hard-coded",
          why: "Hosting platforms tell your app which port to use through an environment variable; a fixed port breaks deploys and running two copies.",
          fix: "Read it from the environment with a default, e.g. PORT from process.env / os.environ, falling back to 3000.",
          learn: "Twelve-factor config",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const hits = x.grep(/["'`]https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, (p) => !TEST_PATH.test(p) && !SCRIPTISH.test(p) && !/config|\.env|settings/i.test(p));
    return hits.length >= 2
      ? {
          id: "hardcoded-urls",
          severity: "low",
          area: "scalability",
          title: "localhost addresses are written into the code",
          why: "It works on your laptop and breaks the moment the app runs anywhere else.",
          fix: "Put addresses in config / environment variables and read them in one place.",
          learn: "Twelve-factor config",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const hits = x.grep(/SELECT\s+\*\s+FROM\s+\w+\s*["'`;)]|\.find\(\s*\{\s*\}\s*\)|\.objects\.all\(\)|\.findMany\(\s*\)/i, (p) => !TEST_PATH.test(p));
    return hits.length
      ? {
          id: "no-pagination",
          severity: "low",
          area: "scalability",
          title: "Some queries load a whole table at once",
          why: "Fine with 10 rows, painfully slow with 100,000 — and it all goes into memory.",
          fix: "Add LIMIT / pagination (page + page size, or a cursor) and select only the columns you need.",
          learn: "Pagination",
          files: fileList(hits),
        }
      : null;
  },
  (x) => {
    const service = /API|Full-stack|Monorepo/.test(x.kind);
    if (!service) return null;
    return x.grep(/["'`]\/(api\/)?(health|healthz|ping|status)["'`]/).length
      ? null
      : {
          id: "no-health",
          severity: "low",
          area: "scalability",
          title: "No health-check endpoint",
          why: "Load balancers and hosting platforms ping a health URL to know whether to send traffic to your app or restart it.",
          fix: "Add GET /health that returns 200 with a tiny JSON body like ok: true.",
          learn: "Health checks",
        };
  },
];

/* ───────────────────────── strengths ───────────────────────── */

export function strengths(x: Ctx, findings: RepoFinding[]): { title: string; detail: string }[] {
  const ids = new Set(findings.map((f) => f.id));
  const out: { title: string; detail: string }[] = [];
  if (x.tests.length && !ids.has("few-tests")) out.push({ title: "Has automated tests", detail: `${x.tests.length} test file${x.tests.length === 1 ? "" : "s"} — changes can be checked, not guessed.` });
  if (!ids.has("no-ci")) out.push({ title: "CI runs on every push", detail: "A robot checks each change before it reaches main." });
  const present = x.layers.filter((l) => ["ui", "api", "logic", "data"].includes(l.id) && l.present).length;
  if (present >= 3 && !ids.has("routes-touch-db")) out.push({ title: "Clear layers", detail: "Screens, routes, logic and data live in separate places — the core of a scalable design." });
  if (!ids.has("no-readme") && !ids.has("thin-readme") && !ids.has("readme-no-run")) out.push({ title: "Helpful README", detail: "A newcomer can find out what it is and how to run it." });
  if (x.has(/\.env\.(example|sample)$/)) out.push({ title: "Settings are documented", detail: ".env.example tells people which settings the app needs." });
  if (x.stack.includes("TypeScript") && !ids.has("ts-not-strict")) out.push({ title: "Strict types", detail: "TypeScript catches whole families of bugs before the code runs." });
  if (x.has(/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|uv\.lock|Pipfile\.lock)$/)) out.push({ title: "Repeatable installs", detail: "A lockfile pins exact dependency versions." });
  if (x.has(/(^|\/)dockerfile$/i)) out.push({ title: "Containerised", detail: "A Dockerfile makes it start the same way on every machine." });
  if (!ids.has("env-committed") && !ids.has("secret-in-code")) out.push({ title: "No secrets spotted", detail: "We didn't find keys or passwords in the files we read." });
  return out.slice(0, 6);
}

/* ───────────────────────── target architecture ───────────────────────── */

export function targetFor(kind: string, stack: string[]): RepoReport["target"] {
  const py = stack.includes("Python") && !stack.some((s) => ["TypeScript", "JavaScript"].includes(s));
  if (/Python script|Small project/.test(kind)) {
    return {
      kind,
      layers: [
        { label: "Entry point", holds: py ? "main.py — reads input, prints output" : "index — reads input, prints output", rule: "No logic here, just wiring." },
        { label: "Logic", holds: "small functions that take values and return values", rule: "No print, no input() — so they're easy to test." },
        { label: "Tests", holds: py ? "tests/test_*.py" : "tests/*.test.*", rule: "One test per function, including the edge cases." },
      ],
      note: "Even a tiny project benefits from separating 'talking to the user' from 'working things out'. That one habit is what makes code testable.",
    };
  }
  return {
    kind,
    layers: [
      { label: "Screens (UI)", holds: py ? "templates / front-end" : "components/, app/ or pages/", rule: "Shows data and sends user actions. No business rules." },
      { label: "API / routes", holds: py ? "routes or views — thin" : "routes/ or app/api — thin", rule: "Read the request, call ONE service, send the result. ~10 lines each." },
      { label: "Services (logic)", holds: "services/ or core/", rule: "The rules of your app as plain functions. No HTTP, no SQL — easy to test." },
      { label: "Data access", holds: "repositories/, models/ or db/", rule: "The ONLY place that talks to the database." },
      { label: "Database & outside APIs", holds: stack.find((s) => /SQL|Mongo|Postgre|Supabase|Firebase|Redis/.test(s)) ?? "your database", rule: "Swappable, because only one layer knows about it." },
    ],
    note: "Each layer only talks to the one below it. That's what lets you add caching, a second database, a mobile app or more servers later without rewriting everything.",
  };
}
