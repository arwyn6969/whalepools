CREATE TABLE IF NOT EXISTS rw_challenges (id TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS rw_sessions (hash TEXT PRIMARY KEY, address TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rw_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rw_seats (
 id TEXT PRIMARY KEY, season TEXT NOT NULL, wallet TEXT NOT NULL, nickname TEXT NOT NULL,
 collection TEXT, token_id INTEGER, strategy TEXT NOT NULL,
 access_basis TEXT NOT NULL, ownership_block TEXT NOT NULL, policy_hash TEXT NOT NULL,
 joined_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(season, wallet), UNIQUE(season, collection, token_id)
);
CREATE TABLE IF NOT EXISTS rw_rule_locks (season TEXT PRIMARY KEY, hash TEXT NOT NULL);
