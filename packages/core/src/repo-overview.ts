/**
 * Repo Analyse — the project explained for a beginner: what it is, its parts
 * (frontend / backend / database / …) with their languages and tools, a
 * folder map, where to start reading, how it runs and how to run it.
 */
import { JUNK_DIR, type PartId, type RepoFile, type RepoLanguage, type RepoOverview, type RepoPart, type RepoSnapshot, type RepoTech, TEST_PATH, base, isCode, lc, lineCount, looksSecret, uniq } from "./repo-shared.ts";

/* ───────────────────────── overview: the project explained for a beginner ───────────────────────── */

export interface LangDef {
  name: string;
  ext: string[];
  color: string;
  kind: RepoLanguage["kind"];
  what: string;
}

export const LANGS: LangDef[] = [
  { name: "TypeScript", ext: ["ts", "tsx", "mts", "cts"], color: "#3178c6", kind: "code", what: "JavaScript with types — the editor catches many mistakes before the code even runs. .tsx files also hold the HTML-like markup of React screens." },
  { name: "JavaScript", ext: ["js", "jsx", "mjs", "cjs"], color: "#e0c341", kind: "code", what: "The language of the web: it makes pages interactive in the browser, and runs servers through Node.js." },
  { name: "Python", ext: ["py", "pyw"], color: "#3572A5", kind: "code", what: "An easy-to-read language used for scripts, back-ends, data and AI." },
  { name: "Jupyter Notebook", ext: ["ipynb"], color: "#DA5B0B", kind: "code", what: "Notebooks mix Python code, its results and notes on one page — popular for data experiments." },
  { name: "Java", ext: ["java"], color: "#b07219", kind: "code", what: "A strict, typed language used for large back-end systems and Android apps." },
  { name: "Kotlin", ext: ["kt", "kts"], color: "#A97BFF", kind: "code", what: "A modern language for Android apps (and some servers)." },
  { name: "Swift", ext: ["swift"], color: "#F05138", kind: "code", what: "Apple's language for iPhone and Mac apps." },
  { name: "Dart", ext: ["dart"], color: "#00B4AB", kind: "code", what: "The language behind Flutter, which builds phone apps from one codebase." },
  { name: "Go", ext: ["go"], color: "#00ADD8", kind: "code", what: "A simple, fast language from Google, popular for servers and command-line tools." },
  { name: "Rust", ext: ["rs"], color: "#dea584", kind: "code", what: "A fast language that stops whole families of memory bugs before the program runs." },
  { name: "Ruby", ext: ["rb"], color: "#a91e50", kind: "code", what: "A friendly language best known for the Ruby on Rails web framework." },
  { name: "PHP", ext: ["php"], color: "#4F5D95", kind: "code", what: "A server language that builds web pages — WordPress and Laravel use it." },
  { name: "C#", ext: ["cs"], color: "#178600", kind: "code", what: "Microsoft's language for .NET back-ends, desktop apps and Unity games." },
  { name: "C", ext: ["c", "h"], color: "#7a7a7a", kind: "code", what: "A low-level language close to the hardware — operating systems are written in it." },
  { name: "C++", ext: ["cpp", "cc", "cxx", "hpp", "hh"], color: "#f34b7d", kind: "code", what: "C with more features, used for games, browsers and fast software." },
  { name: "Scala", ext: ["scala"], color: "#c22d40", kind: "code", what: "A JVM language that mixes object-oriented and functional styles." },
  { name: "Vue", ext: ["vue"], color: "#41b883", kind: "markup", what: "Vue components: the template, logic and style of one piece of the screen in a single file." },
  { name: "Svelte", ext: ["svelte"], color: "#ff3e00", kind: "markup", what: "Svelte components: markup, logic and style that compile into small, fast JavaScript." },
  { name: "HTML", ext: ["html", "htm", "ejs", "hbs", "pug", "njk", "jinja", "jinja2"], color: "#e34c26", kind: "markup", what: "The structure of a web page: headings, text, buttons and forms." },
  { name: "CSS", ext: ["css"], color: "#7c4dbd", kind: "style", what: "How the page looks: colours, spacing, fonts and layout." },
  { name: "SCSS", ext: ["scss", "sass", "less"], color: "#c6538c", kind: "style", what: "CSS with extras like variables and nesting, turned into plain CSS when the site is built." },
  { name: "SQL", ext: ["sql"], color: "#e38c00", kind: "code", what: "The language for asking a database to create tables and to store or find data." },
  { name: "Prisma schema", ext: ["prisma"], color: "#5a67d8", kind: "code", what: "One readable file that describes the database tables, used by the Prisma library." },
  { name: "GraphQL", ext: ["graphql", "gql"], color: "#e10098", kind: "code", what: "A query language where the app asks the server for exactly the fields it needs." },
  { name: "Shell", ext: ["sh", "bash", "zsh"], color: "#89e051", kind: "code", what: "Terminal commands saved in a file, to automate setup, builds and deploys." },
  { name: "PowerShell", ext: ["ps1"], color: "#3d7cc9", kind: "code", what: "Windows terminal scripts for automating tasks." },
  { name: "Batch", ext: ["bat", "cmd"], color: "#4fc04f", kind: "code", what: "Old-style Windows command scripts." },
  { name: "JSON", ext: ["json", "jsonc"], color: "#8a8f98", kind: "data", what: "A plain-text format for settings and data — package.json, for example, lists the project's libraries and scripts." },
  { name: "YAML", ext: ["yml", "yaml"], color: "#cb3837", kind: "data", what: "A readable settings format used for CI workflows, Docker Compose and app config." },
  { name: "TOML", ext: ["toml"], color: "#b0603a", kind: "data", what: "A simple settings format (pyproject.toml, Cargo.toml)." },
  { name: "XML", ext: ["xml"], color: "#2f7fc1", kind: "data", what: "A tag-based data format, common in Java and Android projects." },
  { name: "Markdown", ext: ["md", "mdx"], color: "#4a7bd0", kind: "docs", what: "Formatted text for docs like the README — # makes a heading, ** makes bold." },
];
export const DOCKERFILE_LANG: LangDef = { name: "Dockerfile", ext: [], color: "#5b8fa3", kind: "code", what: "A recipe for building a container — a box holding the app and everything it needs to run." };
export const MAKEFILE_LANG: LangDef = { name: "Makefile", ext: [], color: "#5f9a3c", kind: "code", what: "Short named commands (make build, make test) that run longer ones for you." };
export const LANG_BY_EXT = new Map<string, LangDef>(LANGS.flatMap((l) => l.ext.map((e) => [e, l] as [string, LangDef])));
export const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|poetry\.lock|uv\.lock|pipfile\.lock|cargo\.lock|composer\.lock|gemfile\.lock|go\.sum)$/i;

export function langOf(p: string): LangDef | null {
  const b = base(p).toLowerCase();
  if (/^dockerfile([.-][\w-]+)?$|\.dockerfile$/.test(b)) return DOCKERFILE_LANG;
  if (b === "makefile") return MAKEFILE_LANG;
  const m = b.match(/\.([a-z0-9]+)$/);
  return m ? (LANG_BY_EXT.get(m[1]) ?? null) : null;
}

/** Every framework / tool we can name, in plain words. `part` is where it lives in the project. */
export interface TechDef {
  name: string;
  kind: string;
  part: PartId;
  what: string;
  npm?: string[];
  npmPrefix?: string[];
  py?: string[];
  file?: RegExp;
  content?: RegExp;
}

export const TECH: TechDef[] = [
  // frontend
  { name: "Next.js", kind: "Web framework", part: "frontend", npm: ["next"], what: "A React framework: each folder in app/ (or pages/) becomes a page, and it can run server code too." },
  { name: "React", kind: "UI library", part: "frontend", npm: ["react"], what: "Builds the screen out of small reusable pieces called components." },
  { name: "Vue", kind: "UI framework", part: "frontend", npm: ["vue"], what: "Builds screens from components written as HTML-like templates." },
  { name: "Nuxt", kind: "Web framework", part: "frontend", npm: ["nuxt"], what: "Vue's version of Next.js: pages, routing and server rendering." },
  { name: "Svelte", kind: "UI framework", part: "frontend", npm: ["svelte", "@sveltejs/kit"], what: "Turns components into small, fast JavaScript when the app is built." },
  { name: "Angular", kind: "Web framework", part: "frontend", npm: ["@angular/core"], what: "Google's all-in-one framework for large front-ends." },
  { name: "Streamlit", kind: "Python UI", part: "frontend", py: ["streamlit"], what: "Turns a Python script into a small web app with sliders, tables and charts." },
  { name: "Tailwind CSS", kind: "Styling", part: "frontend", npm: ["tailwindcss"], what: "Style things with small class names like p-4 or text-lg, right in the markup." },
  { name: "Bootstrap", kind: "Styling", part: "frontend", npm: ["bootstrap", "react-bootstrap"], what: "Ready-made CSS for grids, buttons and forms." },
  { name: "Sass", kind: "Styling", part: "frontend", npm: ["sass"], what: "CSS with variables and nesting." },
  { name: "shadcn/ui", kind: "UI components", part: "frontend", npm: ["shadcn"], file: /(^|\/)components\.json$/, what: "Copy-in components (buttons, dialogs) that live in your own code, so you can edit them." },
  { name: "Radix UI", kind: "UI components", part: "frontend", npmPrefix: ["@radix-ui/", "@base-ui/"], what: "Accessible building blocks — menus, tooltips, dialogs — without any styling." },
  { name: "Motion", kind: "Animation", part: "frontend", npm: ["motion", "framer-motion"], what: "Smooth animations for React components." },
  { name: "Lucide icons", kind: "Icons", part: "frontend", npm: ["lucide-react"], what: "A set of clean icons you use like components." },
  { name: "Redux", kind: "State management", part: "frontend", npm: ["redux", "@reduxjs/toolkit"], what: "Keeps app-wide data in one store that every screen reads from." },
  { name: "Zustand", kind: "State management", part: "frontend", npm: ["zustand"], what: "A tiny store for sharing data between components." },
  { name: "TanStack Query", kind: "Data fetching", part: "frontend", npm: ["@tanstack/react-query", "react-query"], what: "Fetches, caches and refreshes server data for React." },
  { name: "React Router", kind: "Routing", part: "frontend", npm: ["react-router-dom", "react-router"], what: "Shows a different screen for each URL in a React app." },
  { name: "Axios", kind: "HTTP client", part: "frontend", npm: ["axios"], what: "Sends requests to APIs — a friendlier version of fetch." },
  { name: "Charts", kind: "Charts", part: "frontend", npm: ["chart.js", "recharts", "d3", "apexcharts"], what: "Draws graphs and charts from data." },
  { name: "Three.js", kind: "3D graphics", part: "frontend", npm: ["three"], what: "Draws 3D scenes in the browser." },
  { name: "Electron", kind: "Desktop apps", part: "frontend", npm: ["electron"], what: "Packages a web app as a desktop app for Windows, Mac and Linux." },
  // mobile
  { name: "React Native", kind: "Mobile framework", part: "mobile", npm: ["react-native"], what: "Builds Android and iPhone apps with React." },
  { name: "Expo", kind: "Mobile toolkit", part: "mobile", npm: ["expo"], what: "Tools that make React Native apps easy to run on your phone and ship." },
  { name: "Flutter", kind: "Mobile framework", part: "mobile", file: /(^|\/)pubspec\.ya?ml$/i, what: "Google's toolkit for phone apps written in Dart." },
  { name: "Android", kind: "Mobile platform", part: "mobile", file: /(^|\/)androidmanifest\.xml$/i, what: "The native Android app project (Gradle builds it)." },
  // backend
  { name: "Express", kind: "Web server", part: "backend", npm: ["express"], what: "A small server framework: you map each URL to a function that answers it." },
  { name: "Fastify", kind: "Web server", part: "backend", npm: ["fastify"], what: "A fast Node.js server framework: routes, request checking and plugins." },
  { name: "NestJS", kind: "Web server", part: "backend", npm: ["@nestjs/core"], what: "A structured Node.js framework with modules, controllers and services." },
  { name: "Koa", kind: "Web server", part: "backend", npm: ["koa"], what: "A minimal Node.js server framework from the Express team." },
  { name: "Hono", kind: "Web server", part: "backend", npm: ["hono"], what: "A tiny, fast server framework that runs almost anywhere." },
  { name: "Django", kind: "Web framework", part: "backend", py: ["django"], file: /(^|\/)manage\.py$/, what: "A batteries-included Python framework: URLs, views, database models and an admin page." },
  { name: "Flask", kind: "Web server", part: "backend", py: ["flask"], what: "A minimal Python web framework — a few lines give you a working API." },
  { name: "FastAPI", kind: "Web server", part: "backend", py: ["fastapi"], what: "A modern Python API framework that checks request data using type hints." },
  { name: "Uvicorn", kind: "App server", part: "backend", py: ["uvicorn"], what: "Runs Python async web apps like FastAPI." },
  { name: "Gunicorn", kind: "App server", part: "backend", py: ["gunicorn"], what: "Runs Python web apps in production with several workers." },
  { name: "Spring Boot", kind: "Web framework", part: "backend", content: /spring-boot/, what: "Java's most popular framework for back-end services." },
  { name: "Socket.IO", kind: "Real-time", part: "backend", npm: ["socket.io", "ws"], what: "Pushes live updates between server and browser — chats, notifications, games." },
  { name: "GraphQL", kind: "API style", part: "backend", npm: ["graphql", "@apollo/server", "apollo-server"], what: "One endpoint where the client asks for exactly the data it needs." },
  { name: "tRPC", kind: "API", part: "backend", npmPrefix: ["@trpc/"], what: "Calls server functions from the front-end with full TypeScript types." },
  { name: "Zod", kind: "Validation", part: "backend", npm: ["zod"], what: "Checks that data has the right shape before your code uses it." },
  { name: "Pydantic", kind: "Validation", part: "backend", py: ["pydantic"], what: "Checks that data has the right types in Python." },
  { name: "Auth.js", kind: "Login", part: "backend", npm: ["next-auth", "@auth/core"], what: "Ready-made sign-in with Google, GitHub, email and more." },
  { name: "Clerk", kind: "Login", part: "backend", npmPrefix: ["@clerk/"], what: "A hosted service for sign-up, sign-in and user profiles." },
  { name: "Passport", kind: "Login", part: "backend", npm: ["passport"], what: "Login strategies (password, Google, GitHub…) for Express." },
  { name: "bcrypt", kind: "Password hashing", part: "backend", npm: ["bcrypt", "bcryptjs", "argon2"], py: ["bcrypt", "passlib", "argon2-cffi"], what: "Turns passwords into a safe one-way hash before they are saved." },
  { name: "JSON Web Tokens", kind: "Login tokens", part: "backend", npm: ["jsonwebtoken", "jose"], py: ["pyjwt", "python-jose"], what: "Signed tokens that prove who a user is on every request." },
  { name: "Stripe", kind: "Payments", part: "backend", npm: ["stripe"], py: ["stripe"], what: "Takes card payments and subscriptions." },
  { name: "Nodemailer", kind: "Email", part: "backend", npm: ["nodemailer"], what: "Sends emails from Node.js." },
  { name: "Celery", kind: "Background jobs", part: "backend", py: ["celery"], what: "Runs slow work (emails, reports) in the background, outside the request." },
  { name: "OpenAI SDK", kind: "AI", part: "backend", npm: ["openai"], py: ["openai"], what: "Calls OpenAI's models from code." },
  { name: "Anthropic SDK", kind: "AI", part: "backend", npm: ["@anthropic-ai/sdk"], py: ["anthropic"], what: "Calls Claude models from code." },
  { name: "Groq SDK", kind: "AI", part: "backend", npm: ["groq-sdk"], py: ["groq"], what: "Calls fast open models hosted by Groq." },
  { name: "Gemini SDK", kind: "AI", part: "backend", npm: ["@google/generative-ai", "@google/genai"], py: ["google-generativeai", "google-genai"], what: "Calls Google's Gemini models from code." },
  { name: "LangChain", kind: "AI", part: "backend", npm: ["langchain"], npmPrefix: ["@langchain/"], py: ["langchain"], what: "Glue for building apps around AI models: prompts, tools, memory." },
  // database
  { name: "Prisma", kind: "ORM", part: "database", npm: ["prisma", "@prisma/client"], file: /(^|\/)schema\.prisma$/, what: "Lets you query the database with JavaScript objects instead of writing raw SQL." },
  { name: "Drizzle", kind: "ORM", part: "database", npm: ["drizzle-orm"], what: "A light, typed way to write SQL queries in TypeScript." },
  { name: "Mongoose", kind: "ODM", part: "database", npm: ["mongoose"], what: "Gives MongoDB documents a schema and handy query methods." },
  { name: "MongoDB", kind: "Database", part: "database", npm: ["mongodb", "mongoose"], py: ["pymongo", "motor"], what: "A document database: it stores JSON-like records instead of tables." },
  { name: "PostgreSQL", kind: "Database", part: "database", npm: ["pg", "postgres"], py: ["psycopg2", "psycopg2-binary", "psycopg", "asyncpg"], what: "A powerful open-source SQL database." },
  { name: "MySQL", kind: "Database", part: "database", npm: ["mysql", "mysql2"], py: ["pymysql", "mysqlclient"], what: "A popular SQL database." },
  { name: "SQLite", kind: "Database", part: "database", npm: ["sqlite3", "better-sqlite3"], content: /["']node:sqlite["']|^\s*import sqlite3\b/m, what: "A whole SQL database in one file — no database server to install." },
  { name: "Redis", kind: "Cache", part: "database", npm: ["redis", "ioredis"], py: ["redis"], what: "A super-fast in-memory store for caches, sessions and queues." },
  { name: "Supabase", kind: "Hosted backend", part: "database", npm: ["@supabase/supabase-js"], py: ["supabase"], what: "Hosted Postgres with sign-in and file storage built in." },
  { name: "Firebase", kind: "Hosted backend", part: "database", npm: ["firebase", "firebase-admin"], py: ["firebase-admin"], what: "Google's hosted database, sign-in and hosting." },
  { name: "SQLAlchemy", kind: "ORM", part: "database", py: ["sqlalchemy", "flask-sqlalchemy"], what: "Talks to SQL databases from Python using classes instead of raw SQL." },
  { name: "Sequelize", kind: "ORM", part: "database", npm: ["sequelize"], what: "An older, popular ORM for SQL databases in Node.js." },
  { name: "TypeORM", kind: "ORM", part: "database", npm: ["typeorm"], what: "Maps TypeScript classes to database tables." },
  { name: "Knex", kind: "Query builder", part: "database", npm: ["knex"], what: "Builds SQL queries with JavaScript and runs migrations." },
  { name: "Alembic", kind: "Migrations", part: "database", py: ["alembic"], what: "Keeps the database tables in step with your Python models, one migration at a time." },
  // ml
  { name: "NumPy", kind: "Maths", part: "ml", py: ["numpy"], what: "Fast maths on big lists of numbers (arrays)." },
  { name: "pandas", kind: "Data tables", part: "ml", py: ["pandas"], what: "Spreadsheet-like tables in Python for cleaning and exploring data." },
  { name: "scikit-learn", kind: "Machine learning", part: "ml", py: ["scikit-learn", "sklearn"], what: "Classic machine-learning models (regression, trees, clustering) with one simple API." },
  { name: "PyTorch", kind: "Deep learning", part: "ml", py: ["torch"], what: "Builds and trains neural networks." },
  { name: "TensorFlow", kind: "Deep learning", part: "ml", py: ["tensorflow", "tensorflow-cpu", "keras"], what: "Google's library for building and training neural networks." },
  { name: "Transformers", kind: "AI models", part: "ml", py: ["transformers"], what: "Ready-trained language and vision models from Hugging Face." },
  { name: "Matplotlib", kind: "Charts", part: "ml", py: ["matplotlib", "seaborn", "plotly"], what: "Draws charts and graphs from data in Python." },
  { name: "OpenCV", kind: "Computer vision", part: "ml", py: ["opencv-python", "opencv-python-headless"], what: "Reads and processes images and video." },
  { name: "Jupyter", kind: "Notebooks", part: "ml", file: /\.ipynb$/i, what: "Notebooks where code, results and notes sit together — great for experiments." },
  // tests
  { name: "Jest", kind: "Testing", part: "tests", npm: ["jest"], what: "Runs JavaScript tests and shows which ones pass or fail." },
  { name: "Vitest", kind: "Testing", part: "tests", npm: ["vitest"], what: "A fast test runner for Vite and TypeScript projects." },
  { name: "Mocha", kind: "Testing", part: "tests", npm: ["mocha"], what: "A classic JavaScript test runner." },
  { name: "Testing Library", kind: "Testing", part: "tests", npmPrefix: ["@testing-library/"], what: "Tests screens the way a user uses them: find the button, click it, check the text." },
  { name: "Playwright", kind: "Browser testing", part: "tests", npm: ["@playwright/test", "playwright"], what: "Drives a real browser to test the app end to end." },
  { name: "Cypress", kind: "Browser testing", part: "tests", npm: ["cypress"], what: "Clicks through the app in a real browser to test it." },
  { name: "pytest", kind: "Testing", part: "tests", py: ["pytest"], what: "Python's favourite test runner: write test_ functions with plain assert." },
  { name: "JUnit", kind: "Testing", part: "tests", content: /<artifactId>junit|junit-jupiter|testImplementation[^\n]*junit/, what: "The standard way to write tests in Java." },
  // devops
  { name: "Docker", kind: "Containers", part: "devops", file: /(^|\/)dockerfile([.-][\w-]+)?$/i, what: "Packs the app and everything it needs into a container that runs the same everywhere." },
  { name: "Docker Compose", kind: "Containers", part: "devops", file: /(^|\/)(docker-)?compose[\w.-]*\.ya?ml$/i, what: "Starts several containers together (app + database) with one command." },
  { name: "GitHub Actions", kind: "CI", part: "devops", file: /^\.github\/workflows\//, what: "Runs checks (install, lint, test) automatically on every push." },
  { name: "Kubernetes", kind: "Deploy", part: "devops", file: /(^|\/)(k8s|kubernetes|helm)\//i, what: "Runs many containers across many servers and keeps them healthy." },
  { name: "Terraform", kind: "Infrastructure", part: "devops", file: /\.tf$/i, what: "Creates cloud servers and databases from code files." },
  { name: "Vercel", kind: "Hosting", part: "devops", file: /(^|\/)vercel\.json$/i, what: "Hosting that deploys a front-end on every push." },
  { name: "Netlify", kind: "Hosting", part: "devops", file: /(^|\/)netlify\.toml$/i, what: "Hosting for front-ends and small serverless functions." },
  { name: "Render", kind: "Hosting", part: "devops", file: /(^|\/)render\.ya?ml$/i, what: "Hosting for web services and databases." },
  { name: "Fly.io", kind: "Hosting", part: "devops", file: /(^|\/)fly\.toml$/i, what: "Runs your app's containers close to users around the world." },
  { name: "Heroku", kind: "Hosting", part: "devops", file: /(^|\/)procfile$/i, what: "Hosting where a Procfile says which command starts the app." },
  // tooling
  { name: "npm workspaces", kind: "Monorepo", part: "tooling", content: /"workspaces"\s*:/, what: "Lets one repo hold several packages that are installed and linked together." },
  { name: "Turborepo", kind: "Monorepo", part: "tooling", file: /(^|\/)turbo\.json$/, what: "Runs builds and tests across many packages, skipping work that hasn't changed." },
  { name: "Vite", kind: "Build tool", part: "tooling", npm: ["vite"], what: "A fast dev server that reloads as you type, and a bundler for production." },
  { name: "Webpack", kind: "Build tool", part: "tooling", npm: ["webpack"], what: "Bundles many JavaScript files into a few for the browser." },
  { name: "ESLint", kind: "Linter", part: "tooling", npm: ["eslint"], file: /(^|\/)(\.eslintrc[\w.]*|eslint\.config\.\w+)$/, what: "Points out likely bugs and messy code as you write." },
  { name: "Prettier", kind: "Formatter", part: "tooling", npm: ["prettier"], file: /(^|\/)(\.prettierrc[\w.]*|prettier\.config\.\w+)$/, what: "Formats code automatically so everyone's code looks the same." },
  { name: "Biome", kind: "Linter", part: "tooling", npm: ["@biomejs/biome"], what: "One fast tool for linting and formatting." },
  { name: "Ruff", kind: "Linter", part: "tooling", py: ["ruff"], file: /(^|\/)\.?ruff\.toml$/, what: "A very fast Python linter and formatter." },
  { name: "Black", kind: "Formatter", part: "tooling", py: ["black"], what: "Formats Python code the same way every time." },
  { name: "tsx", kind: "Runner", part: "tooling", npm: ["tsx"], what: "Runs TypeScript files directly, with no build step." },
  { name: "nodemon", kind: "Dev tool", part: "tooling", npm: ["nodemon"], what: "Restarts the server automatically whenever you save a file." },
  { name: "dotenv", kind: "Config", part: "tooling", npm: ["dotenv"], py: ["python-dotenv"], what: "Loads settings from a .env file into environment variables." },
  { name: "Poetry", kind: "Package manager", part: "tooling", content: /\[tool\.poetry\]/, what: "Installs Python packages and pins their versions." },
];

export const PART_ORDER: PartId[] = ["frontend", "backend", "database", "mobile", "ml", "tests", "devops", "tooling"];
export const PART_DEF: Record<PartId, { label: string; simple: string; folderRole: string }> = {
  frontend: { label: "Frontend", simple: "What users see and click — pages, buttons and styles. It runs in the browser.", folderRole: "Frontend code — what users see." },
  backend: { label: "Backend", simple: "The server: it receives requests, applies the app's rules and sends answers back.", folderRole: "Backend code — it runs on the server." },
  database: { label: "Database", simple: "Where data is saved so it's still there tomorrow, and the code that reads and writes it.", folderRole: "Database code — tables, models and queries." },
  mobile: { label: "Mobile app", simple: "The app that runs on phones (Android / iPhone).", folderRole: "The phone app." },
  ml: { label: "Machine learning", simple: "Code and notebooks that learn from data and then make predictions.", folderRole: "Machine-learning code and notebooks." },
  tests: { label: "Tests", simple: "Code that checks the rest of the code still works.", folderRole: "Automated checks that the code still works." },
  devops: { label: "Ship & run", simple: "How the project is packaged, checked automatically and deployed.", folderRole: "Build, CI and deploy setup." },
  tooling: { label: "Tooling & config", simple: "Settings and helper scripts for installing, building and running the project.", folderRole: "Settings and helper scripts." },
};
export const MAIN_PROGRAM = { label: "Main program", simple: "The code that does the actual work when you run it (there's no web server here)." };

export const NEXT_API = /(^|\/)app\/(.+\/)?api\/(.+\/)?route\.[mc]?[jt]sx?$|(^|\/)pages\/api\//i;
export const DEVOPS_PATH =
  /^\.github\/|^\.circleci\/|(^|\/)(dockerfile([.-][\w-]+)?|\.dockerignore|docker-compose[\w.-]*\.ya?ml|compose\.ya?ml|procfile|vercel\.json|netlify\.toml|fly\.toml|render\.ya?ml|\.gitlab-ci\.yml|jenkinsfile|azure-pipelines\.yml|\.travis\.yml|nginx[\w.-]*\.conf|skaffold\.ya?ml)$|(^|\/)(k8s|kubernetes|helm|charts|terraform|infra|deploy|deployment|ansible)\/|\.tf(vars)?$/i;
export const TOOLING_PATH =
  /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-(lock|workspace)\.yaml|bun\.lockb?|npm-shrinkwrap\.json|tsconfig[\w.-]*\.json|jsconfig\.json|\.eslintrc[\w.]*|\.eslintignore|\.prettierrc[\w.]*|\.prettierignore|biome\.jsonc?|\.editorconfig|\.gitignore|\.gitattributes|\.npmrc|\.nvmrc|\.node-version|\.python-version|\.env(\.[\w-]+)?|requirements[\w-]*\.txt|pyproject\.toml|setup\.(py|cfg)|pipfile(\.lock)?|poetry\.lock|uv\.lock|tox\.ini|\.flake8|\.?ruff\.toml|\.pylintrc|makefile|justfile|go\.(mod|sum)|cargo\.(toml|lock)|composer\.(json|lock)|gemfile(\.lock)?|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|gradlew(\.bat)?|\.babelrc|turbo\.json|nx\.json|project\.json|components\.json|next-env\.d\.ts|[\w-]+\.(config|preset|setup)\.[mc]?[jt]s|[\w-]+\.config\.json)$|(^|\/)(scripts?|bin|tools|\.vscode|\.husky|\.devcontainer|\.idea)\/|\.d\.ts$|\.(sh|bash|ps1|bat|cmd)$/i;
export const DOCS_PATH = /(^|\/)(docs?|documentation)\/|\.(md|mdx|rst|adoc|txt)$|(^|\/)(license|licence|copying|notice|authors|changelog|contributing|code_of_conduct|security)(\.\w+)?$/i;
export const MOBILE_PATH = /(^|\/)(android|ios)\/|\.(swift|dart|kt|kts|xib|storyboard)$|(^|\/)(androidmanifest\.xml|pubspec\.ya?ml|podfile|eas\.json)$/i;
export const ML_PATH = /\.(ipynb|pt|pth|h5|hdf5|onnx|pkl|joblib|safetensors|ckpt|tflite|npy|npz|parquet)$|(^|\/)(notebooks?|ml|training)\//i;
export const ML_IMPORT = /^\s*(import|from)\s+(torch|tensorflow|keras|sklearn|transformers|xgboost|lightgbm|catboost)\b/m;
export const DB_PATH =
  /(^|\/)(db|database|models?|entities|schemas?|repositor(y|ies)|dao|prisma|drizzle|migrations?|alembic|seeds?)\/|\.(sql|prisma|sqlite3?|db)$|(^|\/)models\.py$|(^|\/)(db|database|prisma|mongo(ose)?|supabase|firebase|drizzle|knex|sequelize|redis)\.[mc]?[jt]s$/i;
export const FRONT_EXT = /\.(tsx|jsx|vue|svelte|astro|html?|css|scss|sass|less|ejs|hbs|pug|njk)$/i;
export const FRONT_DIR = /(^|\/)(components?|pages|public|static|styles|css|hooks|templates|assets|frontend|client|layouts|screens|widgets|ui|views)\//i;
export const SERVER_PATH =
  /(^|\/)(server|api|backend|routes?|controllers?|handlers?|services?|middlewares?|endpoints?|resolvers?|graphql|actions|jobs|workers?|lambdas?|functions)\/|(^|\/)(server|app|main|wsgi|asgi|manage|urls|views|middleware|worker)\.(py|[mc]?[jt]s|go|rb|php)$/i;
export const JS_FILE = /\.(m?[jt]sx?|cjs)$/i;

export const UI_DEPS = ["react", "react-dom", "vue", "svelte", "@angular/core", "solid-js", "preact", "vite"];
export const META_DEPS = ["next", "nuxt", "@sveltejs/kit", "astro", "@remix-run/react"];
export const SERVER_DEPS = ["express", "fastify", "@nestjs/core", "koa", "hono", "@hapi/hapi", "restify", "socket.io", "@apollo/server", "apollo-server", "@trpc/server"];
export const PY_SERVER = ["django", "flask", "fastapi", "tornado", "aiohttp", "sanic", "starlette", "bottle", "falcon"];

export interface PkgRoot {
  dir: string;
  deps: Set<string>;
  role: "next" | "frontend" | "backend" | "mobile" | "mixed" | "neutral";
}

/** Each package.json / requirements.txt marks the root of an app or package; its dependencies tell us what kind. */
export function packageRoots(s: RepoSnapshot): PkgRoot[] {
  const byDir = new Map<string, Set<string>>();
  for (const [p, t] of Object.entries(s.contents)) {
    if (JUNK_DIR.test(p)) continue;
    const b = base(p).toLowerCase();
    const dir = p.slice(0, p.length - base(p).length);
    const deps = byDir.get(dir) ?? new Set<string>();
    if (b === "package.json") {
      try {
        const pj = JSON.parse(t) as Record<string, unknown>;
        for (const k of ["dependencies", "devDependencies", "peerDependencies"]) {
          const d = pj[k];
          if (d && typeof d === "object") for (const n of Object.keys(d)) deps.add(n);
        }
      } catch {
        /* not JSON */
      }
    } else if (/^(requirements[\w-]*\.txt|pyproject\.toml|pipfile)$/.test(b)) {
      for (const m of t.toLowerCase().matchAll(/^\s*["']?([a-z0-9_.-]+)/gm)) deps.add("py:" + m[1]);
    } else continue;
    byDir.set(dir, deps);
  }
  return [...byDir.entries()].map(([dir, deps]) => {
    const any = (xs: string[]) => xs.some((x) => deps.has(x));
    const ui = any(UI_DEPS) || deps.has("py:streamlit");
    const srv = any(SERVER_DEPS) || PY_SERVER.some((x) => deps.has("py:" + x));
    const role: PkgRoot["role"] = any(["react-native", "expo"]) ? "mobile" : any(META_DEPS) ? "next" : ui && srv ? "mixed" : ui ? "frontend" : srv ? "backend" : "neutral";
    return { dir, deps, role };
  });
}

export function techHit(t: TechDef, deps: Set<string>, has: (re: RegExp) => boolean, text: string): boolean {
  if (t.npm?.some((n) => deps.has(n))) return true;
  if (t.npmPrefix?.some((pre) => [...deps].some((d) => d.startsWith(pre)))) return true;
  if (t.py?.some((n) => deps.has("py:" + n))) return true;
  if (t.file && has(t.file)) return true;
  return !!t.content && t.content.test(text);
}

/** "apps/web/app/page.tsx" → "apps/web/app/", "src/components/Button.tsx" → "src/components/", "server.js" → "server.js" */
export function folderKey(p: string): string {
  const segs = p.split("/");
  if (segs.length === 1) return p;
  const depth = /^(apps|packages|services|libs|modules|projects)$/i.test(segs[0]) ? 3 : 2;
  return segs.slice(0, Math.min(depth, segs.length - 1)).join("/") + "/";
}

export function topCounts(xs: string[], n: number): string[] {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
}

export function listWords(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export const FOLDER_ROLE: [RegExp, string][] = [
  [/^apps$/, "Each folder inside is a separate app — for example the website and the server."],
  [/^(packages|libs)$/, "Shared code, split into small packages that the apps import."],
  [/^src$/, "The main source code."],
  [/^(docs?|documentation)$/, "Documentation — guides and notes for people, not code."],
  [/^(scripts?|bin|tools)$/, "Helper scripts you run by hand (start, seed, deploy…)."],
  [/^(public|static|assets)$/, "Images, fonts and files sent to the browser exactly as they are."],
  [/^components?$/, "Reusable pieces of the screen — buttons, cards, forms."],
  [/^pages$/, "The pages of the site — one file per URL."],
  [/^(web|frontend|client|ui|site|www|dashboard)$/, "The website — what users see and click."],
  [/^(api|server|backend)$/, "The backend — the server that answers requests."],
  [/^(routes?|controllers?|handlers?|endpoints?)$/, "Matches each URL to the code that answers it."],
  [/^(services?|core|domain|logic|engine)$/, "The rules of the app — the decisions it makes."],
  [/^(lib|utils?|helpers?|common|shared)$/, "Small helper functions used in many places."],
  [/^(db|database|models?|prisma|migrations?|entities|schemas?)$/, "Database code — tables, models and queries."],
  [/^(tests?|__tests__|spec|e2e|harness|cypress)$/, "Automated checks that the code still works."],
  [/^\.github$/, "GitHub settings — including CI workflows that run on every push."],
  [/^(styles?|css|scss)$/, "How things look — colours, spacing, fonts."],
  [/^hooks$/, "Reusable React logic (the use… functions)."],
  [/^(config|settings|conf)$/, "Settings for each environment."],
  [/^(types|typings|@types)$/, "Shared TypeScript type definitions."],
  [/^notebooks?$/, "Jupyter notebooks — experiments with data."],
  [/^(data|datasets?)$/, "Data files the code reads."],
  [/^(android|ios|mobile)$/, "The phone app."],
  [/^(infra|deploy|k8s|kubernetes|terraform|helm)$/, "How it is deployed to servers."],
  [/^templates$/, "HTML templates the server fills in with data."],
  [/^middlewares?$/, "Code that runs before each request — login checks, logging."],
  [/^(store|state|redux)$/, "Where the app keeps data shared between screens."],
  [/^(runner|workers?|jobs|queue|sandbox)$/, "Runs heavy or risky work separately from the main server."],
  [/^(i18n|locales?|lang|translations)$/, "The app's text translated into other languages."],
  [/^(\.vscode|\.idea)$/, "Editor settings."],
  [/^(examples?|demos?|samples?)$/, "Example code showing how to use the project."],
];

export const SERVER_KINDS = new Set(["Web server", "Web framework", "App server", "API style", "API"]);
export const MAIN_TECH_KINDS = new Set(["Web framework", "UI library", "UI framework", "Python UI", "Web server", "Database", "ORM", "ODM", "Mobile framework", "Hosted backend", "Deep learning", "Machine learning"]);

export function readmeLead(s: RepoSnapshot): string | null {
  const readme = Object.entries(s.contents).find(([p]) => /^readme(\.\w+)?$/i.test(p))?.[1];
  if (!readme) return null;
  const blocks = readme.replace(/```[\s\S]*?```/g, "\n\n").split(/\r?\n\s*\r?\n/);
  for (const b of blocks) {
    const lines = b
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^(#|!\[|\[!\[|<|\||---|===|>|[-*+]\s|\d+\.\s)/.test(l));
    if (!lines.length) continue;
    const text = lines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__|`|~~/g, "")
      .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,!?]|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 40 || text.split(" ").length < 6 || looksSecret(text)) continue;
    // skip instructions, banners and badges — we want the sentence that says what the project IS
    if (/:\s*$/.test(text) || /^(run|install|clone|to |npm|yarn|pnpm|pip|git|cd |open|click|follow|see |check|note|make sure|first|step|please|this (repo|readme) (is|was) (generated|created))/i.test(text)) continue;
    if (/\b(logo|sponsor|badge|displayed here|star this|buy me a coffee|table of contents|depends on|environment variables?|prerequisites?|licen[cs]ed?|contribut\w*|pull requests?)\b/i.test(text)) continue;
    if (!/\b(app|application|project|platform|tool|library|framework|website|site|api|game|bot|system|dashboard|course|guide|tutorial|collection|implementation|example|template|service|server|clone|plugin|extension|cli|package|starter|boilerplate|coach|repository|repo|program|script)s?\b/i.test(text)) continue;
    const first = text.match(/^.{20,}?[.!?](\s|$)/)?.[0]?.trim() ?? text;
    return first.length > 240 ? first.slice(0, 237).replace(/\s+\S*$/, "") + "…" : first;
  }
  return null;
}

export interface OverviewIn {
  s: RepoSnapshot;
  clean: RepoFile[];
  deps: Set<string>;
  stack: string[];
  kind: string;
  srcCode: [string, string][];
}

export function buildOverview(a: OverviewIn): RepoOverview {
  const { s, clean, deps, stack, kind } = a;
  const paths = clean.map((f) => f.path);
  const exists = new Set(paths);
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const manifests = Object.entries(s.contents)
    .filter(([p]) => /(^|\/)(pom\.xml|build\.gradle(\.kts)?|pyproject\.toml)$|^package\.json$/i.test(p))
    .map(([, t]) => t)
    .join("\n");
  const text = a.srcCode.map(([, t]) => t).join("\n") + "\n" + manifests;
  const roots = packageRoots(s).sort((x, y) => y.dir.length - x.dir.length);
  const rootOf = (p: string) => roots.find((r) => p.startsWith(r.dir)) ?? null;
  const mobileRepo = has(/(^|\/)(androidmanifest\.xml|pubspec\.ya?ml|podfile)$|\.xcodeproj\//i) || deps.has("react-native") || deps.has("expo");

  // ── tech glossary ──
  const tech: RepoTech[] = TECH.filter((t) => techHit(t, deps, has, text)).map((t) => ({ name: t.name, kind: t.kind, what: t.what, part: t.part }));
  if (stack.includes("SQLite / SQL") && !tech.some((t) => t.name === "SQLite"))
    tech.push({ name: "SQL database", kind: "Database", part: "database", what: "Data is kept in tables and read with SQL queries." });
  const serverish = roots.some((r) => r.role === "backend" || r.role === "mixed") || has(NEXT_API) || tech.some((t) => t.part === "backend" && SERVER_KINDS.has(t.kind));
  // folders holding a web page: a .js file next to an .html page is that page's script (plain HTML/CSS/JS sites)
  const dirOf = (p: string) => p.slice(0, p.length - base(p).length);
  const pageDirs = new Set(paths.filter((p) => /\.html?$/i.test(p) && !/(^|\/)(templates|docs?|coverage)\//i.test(p)).map(dirOf));
  const hasFrontend = roots.some((r) => ["frontend", "next", "mixed"].includes(r.role)) || has(/\.(tsx|jsx|vue|svelte)$/i) || pageDirs.size > 0;
  const hasBackend = serverish || has(/(^|\/)(server|api|backend)\/.+\.\w+$/i);
  if (paths.some((p) => base(p) === "package.json"))
    tech.push({ name: "Node.js", kind: "Runtime", part: hasBackend ? "backend" : "tooling", what: "Runs JavaScript outside the browser — on servers, and on your laptop for tools like npm." });
  tech.sort((x, y) => PART_ORDER.indexOf(x.part) - PART_ORDER.indexOf(y.part));

  // ── which part does each file belong to? ──
  const partOf = (p: string): PartId | null => {
    if (TEST_PATH.test(p)) return "tests";
    if (DEVOPS_PATH.test(p)) return "devops";
    if (mobileRepo && /(^|\/)(android|ios)\//i.test(p)) return "mobile";
    if (TOOLING_PATH.test(p)) return "tooling";
    if (DOCS_PATH.test(p)) return null;
    if (mobileRepo && MOBILE_PATH.test(p)) return "mobile";
    const py = /\.py$/i.test(p);
    if (ML_PATH.test(p) || (py && ML_IMPORT.test(s.contents[p] ?? ""))) return "ml";
    if (NEXT_API.test(p)) return "backend";
    if (DB_PATH.test(p)) return "database";
    const role = rootOf(p)?.role ?? "neutral";
    if (role === "mobile") return "mobile";
    const jsLike = JS_FILE.test(p);
    const code = isCode(p) || /\.(sql|graphql|gql)$/i.test(p);
    if (FRONT_EXT.test(p)) return "frontend";
    // images and fonts only count as frontend when there IS a frontend (an API's src/assets/logo.png isn't one)
    if (FRONT_DIR.test(p) && (jsLike || (!code && hasFrontend))) return "frontend";
    if (!code) return role === "next" || role === "frontend" ? "frontend" : null;
    if (role === "frontend") return "frontend";
    if (SERVER_PATH.test(p)) return "backend";
    if (role === "backend") return "backend";
    if (py && /^\s*(import|from)\s+streamlit\b/m.test(s.contents[p] ?? "")) return "frontend";
    if (role === "next" || (role === "mixed" && jsLike && /(^|\/)(src|client|app)\//i.test(p))) return "frontend";
    if (jsLike && (pageDirs.has(dirOf(p)) || pageDirs.has(dirOf(dirOf(p).replace(/\/$/, ""))))) return "frontend";
    if (jsLike && !hasBackend && hasFrontend) return "frontend";
    return "backend";
  };
  const byPart = new Map<PartId, string[]>();
  const partByPath = new Map<string, PartId | null>();
  for (const p of paths) {
    const id = partOf(p);
    partByPath.set(p, id);
    if (id) byPart.set(id, [...(byPart.get(id) ?? []), p]);
  }

  // ── languages, over every file ──
  const L = new Map<string, { def: LangDef; files: number; lines: number }>();
  for (const f of clean) {
    if (LOCKFILE.test(f.path) || f.size > 500_000 || /\.min\.(js|css)$|\.map$/i.test(f.path)) continue;
    const def = langOf(f.path);
    if (!def) continue;
    const t = s.contents[f.path];
    const lines = t !== undefined ? lineCount(t) : Math.max(1, Math.round(f.size / (def.name === "Jupyter Notebook" ? 150 : 34)));
    const e = L.get(def.name) ?? { def, files: 0, lines: 0 };
    e.files++;
    e.lines += lines;
    L.set(def.name, e);
  }
  const totalLines = [...L.values()].reduce((n, x) => n + x.lines, 0) || 1;
  const languages: RepoLanguage[] = [...L.values()]
    .sort((x, y) => y.lines - x.lines)
    .slice(0, 16)
    .map((x) => ({ name: x.def.name, files: x.files, lines: x.lines, share: Math.round((x.lines / totalLines) * 1000) / 10, color: x.def.color, what: x.def.what, kind: x.def.kind }));

  // ── parts ──
  const parts: RepoPart[] = [];
  for (const id of PART_ORDER) {
    const files = byPart.get(id) ?? [];
    const ptech = tech.filter((t) => t.part === id).map((t) => t.name);
    if (id === "backend" && files.some((p) => NEXT_API.test(p)) && !ptech.includes("Next.js")) ptech.unshift("Next.js");
    // a part needs files of its own — except a database, which can be used straight from the backend (MongoDB, Supabase…)
    const dbOnlyTech = id === "database" && !files.length && tech.some((t) => t.part === "database" && MAIN_TECH_KINDS.has(t.kind));
    if (!files.length && !dbOnlyTech) continue;
    const langs = topCounts(
      files.map((p) => langOf(p)).filter((d): d is LangDef => !!d && d.kind !== "docs").map((d) => d.name),
      5,
    );
    const def = id === "backend" && !serverish ? MAIN_PROGRAM : PART_DEF[id];
    const simple = dbOnlyTech ? `The data lives in ${listWords(ptech.slice(0, 2))}. The code that talks to it sits inside the backend.` : def.simple;
    parts.push({ id, label: def.label, simple, languages: langs, tech: ptech.slice(0, 10), folders: topCounts(files.map(folderKey), 5), files: files.length });
  }
  const part = (id: PartId) => parts.find((p) => p.id === id && p.files > 0) ?? null;

  // ── entry points (used by "start here" and "how it runs") ──
  const depth = (p: string) => p.split("/").length;
  const ENTRY = ["server", "app", "main", "index", "manage", "wsgi", "asgi", "program", "application"];
  const entryRank = (p: string) => ENTRY.indexOf(base(p).toLowerCase().replace(/\.[^.]+$/, ""));
  // (a Next.js app has no server entry file — its API routes are the entries)
  const beEntry =
    (byPart.get("backend") ?? [])
      .filter((p) => (isCode(p) || /\.java$/.test(p)) && entryRank(p) >= 0 && !/\.d\.ts$/.test(p) && !FRONT_EXT.test(p) && rootOf(p)?.role !== "next" && !/(^|\/)(lib|utils?|helpers?)\//i.test(p))
      .sort((x, y) => {
        const rx = ["backend", "mixed"].includes(rootOf(x)?.role ?? "") ? 0 : 1;
        const ry = ["backend", "mixed"].includes(rootOf(y)?.role ?? "") ? 0 : 1;
        return rx - ry || depth(x) - depth(y) || entryRank(x) - entryRank(y);
      })[0] ?? null;
  const FE_ENTRY = /(^|\/)app\/page\.[jt]sx?$|(^|\/)pages\/index\.[jt]sx?$|(^|\/)src\/(App|main|index)\.([jt]sx?|vue)$|(^|\/)App\.(vue|svelte|[jt]sx)$|^index\.html$|(^|\/)(public|src)\/index\.html$/;
  const feEntry = (byPart.get("frontend") ?? []).filter((p) => FE_ENTRY.test(p)).sort((x, y) => depth(x) - depth(y))[0] ?? null;
  const home = (id: PartId, entry: string | null): string | null => {
    const files = byPart.get(id) ?? [];
    if (!files.length) return null;
    const pick = entry ?? files[0];
    const r = rootOf(pick);
    if (r && r.dir) return r.dir;
    if (entry) return entry.includes("/") ? entry.split("/")[0] + "/" : null; // null: the project root itself
    // the folder most of this part lives in — none when it's spread over many (a repo of many small projects)
    const top = topCounts(files.filter((p) => p.includes("/")).map((p) => p.split("/")[0] + "/"), 1)[0];
    return top && files.filter((p) => p.startsWith(top)).length >= files.length * 0.4 ? top : null;
  };

  // ── start reading here ──
  const start: { path: string; why: string }[] = [];
  const add = (p: string | null | undefined, why: string) => {
    if (p && exists.has(p) && !start.some((x) => x.path === p) && start.length < 6) start.push({ path: p, why });
  };
  add(paths.find((p) => /^readme(\.\w+)?$/i.test(p)), "Start here: what the project is, and how to install and run it.");
  const manifest = paths.find((p) => /^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml|pom\.xml|build\.gradle(\.kts)?|composer\.json|gemfile|pubspec\.yaml)$/i.test(p));
  if (manifest)
    add(
      manifest,
      /package\.json$/.test(manifest)
        ? "The project's ID card: the commands you can run (npm run …) and the libraries it uses."
        : /requirements|pyproject/.test(manifest)
          ? "The list of Python packages the project needs."
          : "The project's settings and the libraries it depends on.",
    );
  add(beEntry, serverish ? "Where the backend starts: it creates the server and plugs in the routes." : "Where the program starts — follow the code from here.");
  add(feEntry, "The first screen users see — the front door of the frontend.");
  add(
    paths.filter((p) => /(^|\/)(routes?[\w-]*|urls|router)\.(py|[mc]?[jt]s)$|(^|\/)routes?\/index\.[mc]?[jt]s$/i.test(p) && partByPath.get(p) === "backend").sort((x, y) => depth(x) - depth(y))[0],
    "Where each URL is matched to the code that answers it.",
  );
  add(
    paths.filter((p) => /(^|\/)(schema\.prisma|models\.py|schema\.sql|schema\.[jt]s)$/i.test(p)).sort((x, y) => depth(x) - depth(y))[0],
    "The shape of the data — the tables the database keeps.",
  );
  add(paths.filter((p) => /(^|\/)app\/layout\.[jt]sx$/.test(p)).sort((x, y) => depth(x) - depth(y))[0], "The frame around every page — fonts, header and theme.");
  add(paths.filter((p) => /(^|\/)\.env\.(example|sample)$/i.test(p))[0], "The settings (keys, URLs, ports) you need to fill in before running it.");

  // ── how it runs ──
  const techOf = (id: PartId, n = 2) =>
    tech
      .filter((t) => t.part === id && MAIN_TECH_KINDS.has(t.kind))
      .slice(0, n)
      .map((t) => t.name)
      .join(", ");
  const at = (dir: string | null) => (dir ? ` in \`${dir}\`` : "");
  const fe = part("frontend");
  const be = part("backend");
  const db = part("database");
  const ml = part("ml");
  const mob = part("mobile");
  const feHome = home("frontend", feEntry);
  const beHome = home("backend", beEntry);
  // the database / ML code usually sits in one folder inside an app (backend/models/, src/prisma/) — name that folder
  const fineHome = (id: PartId) => {
    const files = byPart.get(id) ?? [];
    const r = files.length ? rootOf(files[0]) : null;
    if (r?.dir && files.every((p) => p.startsWith(r.dir)) && /(^|\/)(db|database|data|prisma|ml|models?)\/$/i.test(r.dir)) return r.dir;
    const top = topCounts(files.filter((p) => p.includes("/")).map(folderKey), 1)[0];
    return top && files.filter((p) => p.startsWith(top)).length >= files.length * 0.4 ? top : home(id, null);
  };
  const dbHome = fineHome("database");
  const mlHome = fineHome("ml");
  const beRoots = uniq((byPart.get("backend") ?? []).map((p) => rootOf(p)?.dir ?? "").filter(Boolean));
  const logicDir = beRoots.find((d) => d !== beHome && /(^|\/)(core|shared|common|lib|libs|domain|logic|engine)\/$/i.test(d)) ?? null;
  const apiDir = topCounts((byPart.get("backend") ?? []).filter((p) => NEXT_API.test(p)).map(folderKey), 1)[0] ?? null;
  const dbTech = techOf("database");
  const dbStep = db
    ? { part: "database" as const, text: `It reads or saves data through the database code${at(dbHome)}${dbTech ? ` (${dbTech})` : ""}.` }
    : parts.some((p) => p.id === "database")
      ? { part: "database" as const, text: `It reads or saves data in the database${dbTech ? ` (${dbTech})` : ""}.` }
      : null;
  const flow: RepoOverview["flow"] = [];
  if (mob) {
    flow.push({ part: "user", text: `You open the app on your phone. Its screens live${at(home("mobile", null))}${techOf("mobile") ? ` (${techOf("mobile")})` : ""}.` });
    flow.push({ part: "mobile", text: "Tapping a button runs the app's own code, right on the phone." });
    if (be) flow.push({ part: "backend", text: `When it needs shared data, it sends a request to the backend${at(beHome)}${techOf("backend") ? ` (${techOf("backend")})` : ""}.` });
    if (dbStep) flow.push(dbStep);
    flow.push({ part: "mobile", text: "The answer comes back and the screen updates." });
  } else if (fe && be && serverish) {
    const nextOnly = !!apiDir && !roots.some((r) => r.role === "backend" || r.role === "mixed");
    if (nextOnly) {
      flow.push({ part: "user", text: `You open a page in the browser. ${techOf("frontend", 1) || "The framework"} builds it from the files${at(feHome)}.` });
      flow.push({ part: "frontend", text: `Buttons and forms run in the browser. When they need data, they call an API route in \`${apiDir}\`.` });
      flow.push({ part: "backend", text: "The API route runs on the server: it checks the request and applies the app's rules." });
    } else {
      flow.push({ part: "user", text: `You open the app in your browser. It loads the screens${at(feHome)}${techOf("frontend") ? ` (${techOf("frontend")})` : ""}.` });
      flow.push({ part: "frontend", text: "When you click a button or send a form, the screen sends a request (an HTTP call) to the backend." });
      flow.push({
        part: "backend",
        text: `The backend${at(beHome)}${techOf("backend") ? ` (${techOf("backend")})` : ""} finds the route for that URL and runs the app's rules${logicDir ? ` — the shared logic lives in \`${logicDir}\`` : ""}.`,
      });
    }
    if (dbStep) flow.push(dbStep);
    flow.push({ part: "frontend", text: "The answer goes back to the browser (usually as JSON) and the screen updates to show it." });
  } else if (fe) {
    flow.push({ part: "user", text: `You open the site. The browser downloads the app${at(feHome)}${techOf("frontend") ? ` (${techOf("frontend")})` : ""}.` });
    flow.push({ part: "frontend", text: "Components draw the screen and react to your clicks and typing." });
    flow.push(
      dbStep
        ? { part: "database", text: `Data is saved and loaded${dbTech ? ` with ${dbTech}` : ""}${at(dbHome)}.` }
        : { part: "frontend", text: "If it needs data, it calls an outside API — there's no server code in this repo." },
    );
    flow.push({ part: "frontend", text: "When the data changes, the screen re-draws the parts that use it." });
  } else if (be && serverish) {
    flow.push({ part: "user", text: "A client — a browser, a phone app or another program — sends an HTTP request to the server." });
    const routes = topCounts((byPart.get("backend") ?? []).filter((p) => /(^|\/)(routes?|controllers?|handlers?|api)\//i.test(p)).map(folderKey), 1)[0];
    flow.push({ part: "backend", text: `The server${at(beHome)}${techOf("backend") ? ` (${techOf("backend")})` : ""} matches the URL to a route${routes ? ` in \`${routes}\`` : ""}.` });
    const services = topCounts((byPart.get("backend") ?? []).filter((p) => /(^|\/)(services?|core|domain|logic)\//i.test(p)).map(folderKey), 1)[0];
    flow.push({ part: "backend", text: `The route runs the app's rules${services ? ` in \`${services}\`` : ""}.` });
    if (dbStep) flow.push(dbStep);
    flow.push({ part: "user", text: "It sends back a response — usually JSON — with the result or a clear error." });
  } else if (ml && !be) {
    const dataDir = topCounts(paths.filter((p) => /(^|\/)(data|datasets?)\//i.test(p)).map(folderKey), 1)[0];
    flow.push({ part: "ml", text: `Data is loaded from files${dataDir ? ` in \`${dataDir}\`` : ""}.` });
    flow.push({ part: "ml", text: `Notebooks or scripts${at(mlHome)} clean it and train a model${techOf("ml") ? ` (${techOf("ml")})` : ""}.` });
    flow.push({ part: "ml", text: "The trained model is checked on data it hasn't seen, then used to make predictions." });
  } else if (be) {
    const runCmd = beEntry && /\.py$/.test(beEntry) ? `python ${beEntry}` : beEntry && JS_FILE.test(beEntry) ? `node ${beEntry}` : null;
    flow.push({ part: "user", text: `You run it from the terminal${runCmd ? ` (\`${runCmd}\`)` : ""}.` });
    flow.push({ part: "backend", text: "It reads its input — typed in, from a file or from command-line arguments." });
    flow.push({ part: "backend", text: `Functions${at(beHome)} work out the answer step by step.` });
    if (dbStep) flow.push(dbStep);
    flow.push({ part: "user", text: "It prints or saves the result." });
  }
  if (ml && (fe || be) && flow.length < 5 && !(ml && !be && !fe)) flow.splice(Math.max(1, flow.length - 1), 0, { part: "ml", text: `A trained model${at(mlHome)} turns the data into a prediction.` });

  // ── run it ──
  const commands: { label: string; cmd: string }[] = [];
  const cmd = (label: string, c: string) => {
    if (commands.length < 8 && !commands.some((x) => x.cmd === c) && !looksSecret(c)) commands.push({ label, cmd: c });
  };
  const rootPkg = (() => {
    try {
      return s.contents["package.json"] ? (JSON.parse(s.contents["package.json"]) as { scripts?: Record<string, string> }) : null;
    } catch {
      return null;
    }
  })();
  const pm = has(/^pnpm-lock\.yaml$/) ? "pnpm" : has(/^yarn\.lock$/) ? "yarn" : has(/^bun\.lockb?$/) ? "bun" : "npm";
  const runScript = (name: string, dir = "") => {
    const inDir = dir ? `cd ${dir.replace(/\/$/, "")} && ` : "";
    if (pm === "npm") return `${inDir}npm ${name === "start" || name === "test" ? name : `run ${name}`}`;
    return `${inDir}${pm} ${name === "start" || name === "test" ? name : `run ${name}`}`;
  };
  const SCRIPT_LABEL: [RegExp, string][] = [
    [/^dev$/, "Run it while you code (reloads when you save)"],
    [/^start$/, "Start the app"],
    [/^build$/, "Build it for production"],
    [/^test$/, "Run the tests"],
    [/^test:\w+$/, "Run the tests"],
    [/^lint$/, "Check the code for mistakes"],
    [/^(typecheck|type-check|tsc)$/, "Check the types"],
    [/^format$/, "Format the code"],
    [/^seed$/, "Fill the database with sample data"],
    [/^(migrate|db:migrate)$/, "Update the database tables"],
  ];
  const scriptsOf = (sc: Record<string, string>, dir = "") => {
    for (const [re, label] of SCRIPT_LABEL) {
      const name = Object.keys(sc).find((k) => re.test(k));
      if (name && typeof sc[name] === "string") cmd(re.source === "^test:\\w+$" ? `${label} (${name})` : label, runScript(name, dir));
    }
  };
  if (rootPkg) {
    cmd("Install everything it needs", `${pm} install`);
    if (rootPkg.scripts) scriptsOf(rootPkg.scripts);
  }
  if (!rootPkg?.scripts || !Object.keys(rootPkg.scripts).length) {
    const nested = Object.entries(s.contents)
      .filter(([p]) => /^[^/]+\/(?:[^/]+\/)?package\.json$/.test(p) && !JUNK_DIR.test(p))
      .slice(0, 2);
    for (const [p, t] of nested) {
      try {
        const sc = (JSON.parse(t) as { scripts?: Record<string, string> }).scripts ?? {};
        const dir = p.slice(0, -"package.json".length);
        if (sc.dev || sc.start) {
          cmd(`Install the ${dir.replace(/\/$/, "")} app`, `cd ${dir.replace(/\/$/, "")} && ${pm} install`);
          cmd(`Run the ${dir.replace(/\/$/, "")} app`, runScript(sc.dev ? "dev" : "start", dir));
        }
      } catch {
        /* not JSON */
      }
    }
  }
  const reqFile = paths.find((p) => /^(?:[^/]+\/)?requirements\.txt$/i.test(p));
  if (reqFile) cmd("Install the Python packages", `pip install -r ${reqFile}`);
  else if (exists.has("pyproject.toml")) cmd("Install the Python packages", /\[tool\.poetry\]/.test(s.contents["pyproject.toml"] ?? "") ? "poetry install" : "pip install -e .");
  const managePy = paths.find((p) => /(^|\/)manage\.py$/.test(p));
  if (managePy) {
    cmd("Create the database tables", `python ${managePy} migrate`);
    cmd("Start the Django server", `python ${managePy} runserver`);
  }
  const pyFiles = a.srcCode.filter(([p]) => /\.py$/.test(p));
  // Python servers run from their own project folder (the one with requirements.txt / pyproject.toml)
  const pyDir = (file: string) => roots.find((r) => file.startsWith(r.dir) && [...r.deps].some((d) => d.startsWith("py:")))?.dir ?? "";
  const inDir = (dir: string, c: string) => (dir ? `cd ${dir.replace(/\/$/, "")} && ${c}` : c);
  const fastapi = pyFiles.find(([, t]) => /^\s*(\w+)\s*=\s*FastAPI\(/m.test(t));
  if (fastapi) {
    const varName = fastapi[1].match(/^\s*(\w+)\s*=\s*FastAPI\(/m)![1];
    const dir = pyDir(fastapi[0]);
    cmd("Start the API (reloads when you save)", inDir(dir, `uvicorn ${fastapi[0].slice(dir.length).replace(/\.py$/, "").replace(/\//g, ".")}:${varName} --reload`));
  }
  const streamlitApp = pyFiles.find(([, t]) => /^\s*import streamlit\b|^\s*from streamlit\b/m.test(t));
  if (streamlitApp) cmd("Open the app in your browser", inDir(pyDir(streamlitApp[0]), `streamlit run ${streamlitApp[0].slice(pyDir(streamlitApp[0]).length)}`));
  const flaskApp = pyFiles.find(([, t]) => /\bFlask\(\s*__name__/.test(t));
  if (flaskApp && !fastapi) {
    const dir = pyDir(flaskApp[0]);
    const rel = flaskApp[0].slice(dir.length);
    cmd("Start the Flask server", inDir(dir, /if __name__ == ["']__main__["']/.test(flaskApp[1]) ? `python ${rel}` : `flask --app ${rel.replace(/\.py$/, "")} run --debug`));
  }
  if (!fastapi && !flaskApp && !managePy && !streamlitApp) {
    const mainPy = paths.filter((p) => /(^|\/)(main|app|run|cli)\.py$/.test(p) && partByPath.get(p) !== "tests").sort((x, y) => depth(x) - depth(y))[0];
    if (mainPy) cmd("Run the program", `python ${mainPy}`);
  }
  if (tech.some((t) => t.name === "pytest") || (stack.includes("Python") && byPart.get("tests")?.some((p) => /\.py$/.test(p)))) cmd("Run the tests", "pytest");
  if (exists.has("go.mod")) (cmd("Run it", "go run ."), cmd("Run the tests", "go test ./..."));
  if (exists.has("Cargo.toml")) (cmd("Run it", "cargo run"), cmd("Run the tests", "cargo test"));
  if (exists.has("pom.xml")) cmd(tech.some((t) => t.name === "Spring Boot") ? "Start the server" : "Build it", tech.some((t) => t.name === "Spring Boot") ? "mvn spring-boot:run" : "mvn package");
  if (has(/^(docker-)?compose[\w.-]*\.ya?ml$/i)) cmd("Start everything in containers", "docker compose up");
  if (exists.has("pubspec.yaml")) cmd("Run the app", "flutter run");
  if (!commands.length && pageDirs.size)
    cmd(
      exists.has("index.html") ? "Serve the site, then open the address it prints" : "Serve the folder, then open any project's index.html",
      "npx serve .",
    );

  // ── folder map ──
  const folderFiles = new Map<string, string[]>();
  const NESTABLE = /^(apps|packages|src|services|libs|modules)$/i;
  for (const p of paths) {
    const segs = p.split("/");
    const keys = segs.length === 1 ? ["(root)"] : [segs[0] + "/", ...(NESTABLE.test(segs[0]) && segs.length > 2 ? [segs[0] + "/" + segs[1] + "/"] : [])];
    for (const k of keys) folderFiles.set(k, [...(folderFiles.get(k) ?? []), p]);
  }
  const folderRole = (path: string, files: string[]): string => {
    if (path === "(root)") return "Project-wide files: the README, settings and the list of packages.";
    const name = path.replace(/\/$/, "").split("/").pop()!.toLowerCase();
    let role: string | null = null;
    if (name === "app" && files.some((p) => /(^|\/)app\/(.+\/)?page\.[jt]sx?$/.test(p))) role = "The pages of the site — each folder inside becomes a URL.";
    role ??= FOLDER_ROLE.find(([re]) => re.test(name))?.[1] ?? null;
    if (!role) {
      const major = topCounts(files.map((p) => partByPath.get(p)).filter((x): x is PartId => !!x), 1)[0] as PartId | undefined;
      role = major ? (major === "backend" && !serverish ? "The program's code." : PART_DEF[major].folderRole) : "Project files.";
    }
    const r = roots.find((x) => x.dir === path);
    if (r) {
      const built = TECH.filter((t) => MAIN_TECH_KINDS.has(t.kind) && techHit(t, r.deps, () => false, ""))
        .slice(0, 3)
        .map((t) => t.name);
      if (built.length) role = `${role.replace(/\.$/, "")} — built with ${listWords(built)}.`;
    }
    return role;
  };
  const tops = [...folderFiles.entries()].filter(([k]) => !k.slice(0, -1).includes("/")).sort((x, y) => (x[0] === "(root)" ? 1 : y[0] === "(root)" ? -1 : y[1].length - x[1].length));
  const folders: RepoOverview["folders"] = [];
  for (const [k, fs] of tops) {
    if (folders.length >= 24) break;
    folders.push({ path: k, files: fs.length, role: folderRole(k, fs) });
    const kids = [...folderFiles.entries()].filter(([c]) => c !== k && c.startsWith(k)).sort((x, y) => y[1].length - x[1].length).slice(0, 8);
    for (const [c, cf] of kids) if (folders.length < 24) folders.push({ path: c, files: cf.length, role: folderRole(c, cf) });
  }

  // ── summary ──
  // the repo's own one-line description is curated; a README's first paragraph is sometimes a banner — use it second
  const firstSentence = (t: string) => {
    const x = t.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    const one = x.match(/^.{20,}?[.!?](\s|$)/)?.[0]?.trim() ?? x;
    return (one.length > 240 ? one.slice(0, 237).replace(/\s+\S*$/, "") + "…" : one).replace(/([^.!?…])$/, "$1.");
  };
  const desc = s.description && s.description.trim().length >= 20 && !looksSecret(s.description) ? firstSentence(s.description) : null;
  const lead = desc ?? readmeLead(s);
  const codeLangs = languages
    .filter((l) => l.kind === "code" || l.kind === "markup")
    .filter((l, i) => i === 0 || l.share >= 12)
    .slice(0, 2)
    .map((l) => l.name);
  const mainTech = tech.filter((t) => MAIN_TECH_KINDS.has(t.kind)).slice(0, 4).map((t) => t.name);
  const k = lc(kind);
  const art = /^[aeiou]/i.test(k) ? "an" : "a";
  const s2 = `It's ${art} ${k}${codeLangs.length ? ` written mainly in ${listWords(codeLangs)}` : ""}${mainTech.length ? `, using ${listWords(mainTech)}` : ""}.`;
  const NOUN: Partial<Record<PartId, string>> = { frontend: "a frontend", backend: serverish ? "a backend" : "the main program", database: "a database", mobile: "a mobile app", ml: "machine-learning code" };
  const EXTRA: Partial<Record<PartId, string>> = { tests: "tests", devops: "deploy / CI setup", tooling: "tooling" };
  const mainParts = parts.map((p) => NOUN[p.id]).filter((x): x is string => !!x);
  const extraParts = parts.map((p) => EXTRA[p.id]).filter((x): x is string => !!x);
  const s3 = mainParts.length ? `It has ${listWords(mainParts)}${extraParts.length ? `, plus ${listWords(extraParts)}` : ""} — ${clean.length} files in all.` : `It has ${clean.length} files.`;
  const summary = [lead, s2, s3].filter(Boolean).join(" ");

  return {
    summary,
    parts,
    languages,
    tech,
    folders,
    start_here: start,
    how_it_runs: flow.map((f) => f.text),
    flow,
    commands,
  };
}
