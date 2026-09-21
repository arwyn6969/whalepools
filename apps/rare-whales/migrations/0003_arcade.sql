CREATE TABLE IF NOT EXISTS rw_arcade_entries (
 season TEXT NOT NULL, wallet TEXT NOT NULL, id TEXT NOT NULL UNIQUE,
 nickname TEXT NOT NULL, captain_collection TEXT NOT NULL, captain_id INTEGER NOT NULL,
 agents_json TEXT NOT NULL, stats_json TEXT NOT NULL, rank_score INTEGER NOT NULL,
 ownership_block TEXT NOT NULL, rule_hash TEXT NOT NULL,
 joined_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(season,wallet)
);
CREATE INDEX IF NOT EXISTS rw_arcade_ranking ON rw_arcade_entries(season,rank_score DESC,updated_at,id);
CREATE INDEX IF NOT EXISTS rw_challenges_expiry ON rw_challenges(expires);
CREATE INDEX IF NOT EXISTS rw_sessions_expiry ON rw_sessions(expires);
CREATE INDEX IF NOT EXISTS rw_limits_expiry ON rw_limits(expires);
