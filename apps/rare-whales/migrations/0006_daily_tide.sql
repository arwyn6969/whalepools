CREATE INDEX IF NOT EXISTS wp_paper_wallet_history ON wp_paper_runs(wallet,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS wp_tide_rounds (
 id TEXT PRIMARY KEY, rules_hash TEXT NOT NULL, rules_json TEXT NOT NULL,
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN('queued','running','completed','paused')),
 state_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, commit_token TEXT,
 quality TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS wp_tide_dates ON wp_tide_rounds(starts_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS wp_tide_picks (
 id TEXT PRIMARY KEY, round_id TEXT NOT NULL REFERENCES wp_tide_rounds(id),
 wallet TEXT NOT NULL, nickname TEXT NOT NULL, preset TEXT NOT NULL,
 collection TEXT NOT NULL, token_id INTEGER NOT NULL, ownership_block TEXT NOT NULL,
 joined_at INTEGER NOT NULL, mutation_id TEXT NOT NULL, input_json TEXT NOT NULL,
 UNIQUE(round_id,wallet), UNIQUE(wallet,mutation_id)
);
CREATE TABLE IF NOT EXISTS wp_tide_events (
 round_id TEXT NOT NULL REFERENCES wp_tide_rounds(id), preset TEXT NOT NULL,
 bar_t INTEGER NOT NULL, ordinal INTEGER NOT NULL, event_json TEXT NOT NULL,
 PRIMARY KEY(round_id,preset,bar_t,ordinal)
);
CREATE TABLE IF NOT EXISTS wp_tide_runtime (
 id INTEGER PRIMARY KEY CHECK(id=1), lock_owner TEXT, lock_until INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO wp_tide_runtime(id) VALUES(1);
