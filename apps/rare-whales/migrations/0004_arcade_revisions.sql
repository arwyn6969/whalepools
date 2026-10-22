-- A wallet's revision survives public withdrawal, so late creates cannot restore
-- an entry after a newer publish, edit or removal. This is private server state.
CREATE TABLE IF NOT EXISTS rw_arcade_revisions (
 season TEXT NOT NULL, wallet TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
 mutation_id TEXT, commit_token TEXT,
 PRIMARY KEY(season,wallet)
);
