-- Layerflow — the system of record. One local SQLite file (node:sqlite, built into Node).
-- Works with the network cable pulled. Reset = delete apps/api/data/layerflow.db* and `npm run seed`.
--
-- 🔒 There is NO challenges table: challenges and their hidden tests are static
--    code in packages/core/src/challenge-bank.ts, held in API memory only.
-- 🔒 test_results.detail holds a limit NAME only; test_results.got is NULL for
--    every hidden test — enforced by a CHECK constraint, not by good intentions.

CREATE TABLE IF NOT EXISTS learners (
  id         TEXT PRIMARY KEY,                 -- pseudonymous: rohan, meera, kabir
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
  source     TEXT NOT NULL CHECK (source IN ('github', 'local')),
  score      INTEGER NOT NULL,
  grade      TEXT NOT NULL,
  report     TEXT NOT NULL,                      -- RepoReport JSON (never contains a secret's value)
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_replies_post  ON replies(post_id);
CREATE INDEX IF NOT EXISTS idx_repo_learner  ON repo_reports(learner_id, created_at);
