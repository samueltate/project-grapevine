CREATE TABLE IF NOT EXISTS response_workspace_state (
  id TEXT PRIMARY KEY CHECK (id = 'active'),
  reset_at TEXT NOT NULL
);

INSERT OR REPLACE INTO response_workspace_state (id, reset_at)
VALUES ('active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
