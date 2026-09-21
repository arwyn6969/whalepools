CREATE TABLE IF NOT EXISTS rw_agents (
 season TEXT NOT NULL,
 collection TEXT NOT NULL,
 token_id INTEGER NOT NULL,
 pool_id TEXT NOT NULL REFERENCES rw_seats(id) ON DELETE CASCADE,
 strategy TEXT NOT NULL,
 modifier_version TEXT NOT NULL,
 modifier_json TEXT NOT NULL,
 ownership_block TEXT NOT NULL,
 joined_at INTEGER NOT NULL,
 PRIMARY KEY(season,collection,token_id)
);
CREATE INDEX IF NOT EXISTS rw_agents_pool ON rw_agents(pool_id);
