-- Layerflow — the system of record. One local SQLite file (node:sqlite, built into Node).
-- Works with the network cable pulled. Reset = delete apps/api/data/layerflow.db* and `npm run seed`.
--
-- 🔒 There is NO challenges table: challenges and their hidden tests are static
--    code in packages/core/src/challenge-bank.ts, held in API memory only.
-- 🔒 test_results.detail holds a limit NAME only; test_results.got is NULL for
--    every hidden test — enforced by a CHECK constraint, not by good intentions.

CREATE TABLE IF NOT EXISTS learners (
  id         TEXT PRIMARY KEY,                 -- pseudonymous: yash, riya, khushi
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery (
  learner_id TEXT NOT NULL,
  concept    TEXT NOT NULL,
  alpha      REAL NOT NULL DEFAULT 1,            -- Beta posterior
  beta       REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (learner_id, concept)
);

CREATE TABLE IF NOT EXISTS submissions (
  id           TEXT PRIMARY KEY,                 -- s_0142
  seq          INTEGER NOT NULL UNIQUE,
  learner_id   TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  code         TEXT NOT NULL,
  passed       INTEGER NOT NULL,
  mistake_tags TEXT NOT NULL,                    -- JSON array (at most one primary tag)
  explanation  TEXT NOT NULL,
  hints_used   INTEGER NOT NULL DEFAULT 0,
  ladder_key   TEXT NOT NULL DEFAULT 'generic',
  analysis     TEXT,                             -- Line Map JSON (the learner's own code only)
  duration_ms  INTEGER,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_results (
  submission_id TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('visible', 'hidden')),
  test_no       INTEGER NOT NULL,
  outcome       TEXT NOT NULL CHECK (outcome IN ('passed', 'wrong_output', 'runtime_error', 'timeout')),
  detail        TEXT CHECK (detail IS NULL OR detail IN (
                  'memory limit', 'output limit', 'disk limit', 'cpu limit', 'process limit',
                  'recursion limit', 'sandbox policy', 'sandbox restart', 'input changed')),
  got           TEXT CHECK (kind = 'visible' OR got IS NULL),
  PRIMARY KEY (submission_id, kind, test_no)
);

CREATE TABLE IF NOT EXISTS hints (
  submission_id TEXT NOT NULL,
  idx           INTEGER NOT NULL,                -- 1.. per submission
  rung          INTEGER NOT NULL,                -- 1 nudge | 2 specific | 3 mechanism | 4 built-in
  learner_id    TEXT NOT NULL,
  challenge_id  TEXT NOT NULL,
  ladder_key    TEXT NOT NULL,
  text          TEXT NOT NULL,                   -- prose only; passed the validator
  asked_for_answer INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (submission_id, idx)
);

CREATE TABLE IF NOT EXISTS ledger (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                TEXT NOT NULL,
  kind              TEXT NOT NULL,               -- 'explanation' | 'hint' | 'chat' | 'mentor' | 'repo'
  learner_id        TEXT,
  submission_id     TEXT,
  prompt            TEXT NOT NULL,
  response          TEXT NOT NULL,
  model             TEXT,                        -- NULL = deterministic tier
  rejected_for_code INTEGER NOT NULL DEFAULT 0   -- proof the guardrail fired
);

CREATE TABLE IF NOT EXISTS bug_seeds (            -- OB3 Bug Factory templates
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL UNIQUE,
  mistake_tag  TEXT NOT NULL,
  buggy_code   TEXT NOT NULL,
  culprit_line INTEGER NOT NULL,
  hint         TEXT NOT NULL,
  difficulty   INTEGER NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS bug_finds (            -- "Find it" attempts
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id   TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  line         INTEGER NOT NULL,
  correct      INTEGER NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sub_learner   ON submissions(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sub_challenge ON submissions(learner_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_ledger        ON ledger(learner_id);
CREATE INDEX IF NOT EXISTS idx_hints_lc      ON hints(learner_id, challenge_id, ladder_key);

-- ── Community (students help each other, teachers mentor) ──
CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY,                 -- a learner id, or a teacher id (teacher_james)
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'mentor_ai')),
  avatar       TEXT,                             -- /people/*.jpg or NULL (initials)
  bio          TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id         TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('question', 'discussion', 'tip', 'showcase')),
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  challenge_id      TEXT,                        -- the practice problem it is about (optional)
  spoiler           INTEGER NOT NULL DEFAULT 0,  -- contains a solution → blurred until solved
  accepted_reply_id INTEGER,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  spoiler    INTEGER NOT NULL DEFAULT 0,
  ai         INTEGER NOT NULL DEFAULT 0,         -- written by the AI mentor (prose-only, guarded)
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  voter_id  TEXT NOT NULL,
  target    TEXT NOT NULL CHECK (target IN ('post', 'reply')),
  target_id INTEGER NOT NULL,
  value     INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (voter_id, target, target_id)
);

-- ── Repo Analyse reports ──
CREATE TABLE IF NOT EXISTS repo_reports (
  id         TEXT PRIMARY KEY,                   -- r_0001
  learner_id TEXT,
  repo       TEXT NOT NULL,                      -- owner/name or "local"
  source     TEXT NOT NULL CHECK (source IN ('github', 'local', 'site')),  -- site = Website Analyse (a live URL)
  score      INTEGER NOT NULL,
  grade      TEXT NOT NULL,
  report     TEXT NOT NULL,                      -- RepoReport JSON (never contains a secret's value)
  created_at TEXT NOT NULL
);

-- ── Rewards: streak points, redemptions, wallet PINs ──
CREATE TABLE IF NOT EXISTS points_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id TEXT NOT NULL,
  delta      INTEGER NOT NULL,                   -- + earned · − spent
  kind       TEXT NOT NULL CHECK (kind IN ('streak_day', 'bounty', 'redeem', 'refund', 'adjust')),
  ref        TEXT NOT NULL,                      -- the day (YYYY-MM-DD), a report id or a redemption id
  note       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (learner_id, kind, ref)                 -- a day / a report / a redemption pays exactly once
);

CREATE TABLE IF NOT EXISTS redemptions (
  id           TEXT PRIMARY KEY,                 -- rd_0001
  learner_id   TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('cash', 'goodie')),
  item_id      TEXT,                             -- goodie id
  size         TEXT,
  points       INTEGER NOT NULL CHECK (points > 0),
  amount_paise INTEGER NOT NULL,                 -- what the points are worth
  upi_id       TEXT,                             -- cash only · only ever sent back masked
  shipping     TEXT,                             -- goodie only · JSON · only ever sent back masked
  status       TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'paid', 'shipped', 'delivered', 'rejected', 'cancelled')),
  note         TEXT,
  payout_ref   TEXT,                             -- UPI reference / tracking number, added by an admin
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_pins (         -- protects cash-outs: there are no passwords in Layerflow
  learner_id   TEXT PRIMARY KEY,
  salt         TEXT NOT NULL,
  hash         TEXT NOT NULL,                    -- scrypt
  failed       INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at   TEXT NOT NULL
);

-- ── Bug Bounty (Layerflow's own programs are static code in packages/core) ──
CREATE TABLE IF NOT EXISTS bounty_programs (
  id           TEXT PRIMARY KEY,                 -- bp_0001
  owner_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('company', 'open_source')),
  company      TEXT NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,
  repo_url     TEXT,
  website      TEXT,
  scope        TEXT NOT NULL,                    -- JSON string[]
  out_of_scope TEXT NOT NULL,                    -- JSON string[]
  rewards      TEXT NOT NULL,                    -- JSON {critical, high, medium, low} in points
  plan         TEXT NOT NULL,
  points_pool  INTEGER NOT NULL DEFAULT 0,       -- unlocked by a paid plan
  points_paid  INTEGER NOT NULL DEFAULT 0 CHECK (points_paid <= points_pool),
  status       TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'open', 'paused', 'closed')),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bounty_reports (
  id             TEXT PRIMARY KEY,               -- br_0001
  program_id     TEXT NOT NULL,
  learner_id     TEXT NOT NULL,
  title          TEXT NOT NULL,
  category       TEXT NOT NULL,
  severity       TEXT NOT NULL,                  -- what the hunter claimed
  file           TEXT,
  line           INTEGER,
  description    TEXT NOT NULL,
  steps          TEXT,
  impact         TEXT,
  fix            TEXT,
  status         TEXT NOT NULL CHECK (status IN ('triage', 'valid', 'duplicate', 'needs_info', 'invalid')),
  bug_id         TEXT,                           -- the planted bug it matched (Layerflow programs) — never sent unless valid
  final_severity TEXT,
  points         INTEGER NOT NULL DEFAULT 0,
  triage_note    TEXT,
  created_at     TEXT NOT NULL,
  triaged_at     TEXT
);

CREATE TABLE IF NOT EXISTS bounty_nudges (
  learner_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  bug_id     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, program_id, bug_id)
);

-- ── Payments (Razorpay orders; the demo checkout when no keys are set) ──
CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,                 -- pay_0001 (ours)
  provider     TEXT NOT NULL DEFAULT 'razorpay', -- razorpay | demo (older rows: dodo)
  purpose      TEXT NOT NULL CHECK (purpose IN ('bounty_plan', 'subscription')),
  ref          TEXT NOT NULL,                    -- the program id (bounty_plan) or learner id (subscription)
  sku          TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,                 -- smallest unit of `currency` (paise or cents)
  currency     TEXT NOT NULL DEFAULT 'INR',
  session_id   TEXT,                             -- Razorpay order_… id (demo_… for the demo checkout)
  payment_id   TEXT,                             -- Razorpay's pay_… id
  checkout_url TEXT,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dodo_products (       -- one Dodo product per plan, created on first use
  sku        TEXT NOT NULL,
  mode       TEXT NOT NULL,                      -- test_mode | live_mode
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (sku, mode)
);

CREATE TABLE IF NOT EXISTS webhook_events (      -- Standard Webhooks retry: process each webhook-id once
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  received_at TEXT NOT NULL
);

-- ── Plans: Free / Pro ($4 · ₹349 a month) / Custom ──
CREATE TABLE IF NOT EXISTS subscriptions (       -- one row per learner who has ever had Pro
  learner_id           TEXT PRIMARY KEY,
  plan                 TEXT NOT NULL CHECK (plan IN ('pro')),
  status               TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  provider             TEXT NOT NULL CHECK (provider IN ('razorpay', 'demo', 'dodo')),
  currency             TEXT NOT NULL,            -- USD | INR
  amount               INTEGER NOT NULL,         -- per month, smallest unit
  subscription_id      TEXT,                     -- a provider subscription id, if Pro is ever auto-renewed
  payment_id           TEXT,                     -- the payment that started (or last renewed) it
  current_period_end   TEXT NOT NULL,            -- Pro until this moment, even after cancelling
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_daily (         -- what the Free plan counts: chat, mentor, analyse
  learner_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  day        TEXT NOT NULL,                      -- local day (IST by default)
  n          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (learner_id, kind, day)
);

CREATE TABLE IF NOT EXISTS plan_leads (          -- "Talk to us" requests for the Custom plan
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  organisation TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('college', 'company', 'other')),
  seats        INTEGER,
  message      TEXT,
  learner_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'won', 'lost')),
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_learner  ON points_ledger(learner_id);
CREATE INDEX IF NOT EXISTS idx_redeem_learner  ON redemptions(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_program ON bounty_reports(program_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_learner ON bounty_reports(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_replies_post  ON replies(post_id);
CREATE INDEX IF NOT EXISTS idx_repo_learner  ON repo_reports(learner_id, created_at);
