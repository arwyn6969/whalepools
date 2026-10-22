CREATE TABLE IF NOT EXISTS wp_paper_feed (
 id INTEGER PRIMARY KEY CHECK(id=1), coin TEXT, last_ok INTEGER, last_attempt INTEGER,
 error TEXT, halted INTEGER NOT NULL DEFAULT 0, lock_owner TEXT, lock_until INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO wp_paper_feed(id) VALUES(1);
CREATE TABLE IF NOT EXISTS wp_paper_bars (
 t INTEGER PRIMARY KEY, o REAL NOT NULL, h REAL NOT NULL, l REAL NOT NULL, c REAL NOT NULL,
 observed_at INTEGER NOT NULL, fresh INTEGER NOT NULL CHECK(fresh IN(0,1))
);
CREATE TABLE IF NOT EXISTS wp_paper_runs (
 id TEXT PRIMARY KEY, wallet TEXT, nickname TEXT NOT NULL, mutation_id TEXT,
 input_json TEXT NOT NULL, rules_hash TEXT NOT NULL, ownership_block TEXT,
 created_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN('running','stopped','completed')),
 revision INTEGER NOT NULL DEFAULT 0, commit_token TEXT, state_json TEXT NOT NULL,
 UNIQUE(wallet,mutation_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS wp_one_active_paper ON wp_paper_runs(wallet) WHERE status='running' AND wallet IS NOT NULL;
CREATE TABLE IF NOT EXISTS wp_paper_events (
 run_id TEXT NOT NULL REFERENCES wp_paper_runs(id), bar_t INTEGER NOT NULL,
 ordinal INTEGER NOT NULL, event_json TEXT NOT NULL, PRIMARY KEY(run_id,bar_t,ordinal)
);
CREATE INDEX IF NOT EXISTS wp_paper_run_events ON wp_paper_events(run_id,bar_t DESC);
