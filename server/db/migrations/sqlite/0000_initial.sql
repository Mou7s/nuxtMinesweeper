CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (username_lower);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  challenge_date TEXT,
  seed TEXT NOT NULL,
  rows INTEGER NOT NULL,
  cols INTEGER NOT NULL,
  mines INTEGER NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS challenges_date_unique ON challenges (challenge_date);
CREATE INDEX IF NOT EXISTS challenges_kind_idx ON challenges (kind);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL,
  user_id TEXT,
  mode TEXT NOT NULL,
  room_id TEXT,
  status TEXT NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  elapsed_ms INTEGER,
  penalty_ms INTEGER NOT NULL DEFAULT 0,
  mine_hits INTEGER NOT NULL DEFAULT 0,
  action_count INTEGER NOT NULL DEFAULT 0,
  completion_seq INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_user_idx ON runs (user_id);
CREATE INDEX IF NOT EXISTS runs_challenge_idx ON runs (challenge_id);
CREATE INDEX IF NOT EXISTS runs_room_idx ON runs (room_id);

CREATE TABLE IF NOT EXISTS daily_scores (
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  effective_ms INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  penalty_ms INTEGER NOT NULL,
  mine_hits INTEGER NOT NULL,
  completion_seq INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS daily_scores_ranking_idx ON daily_scores (challenge_id, effective_ms, completion_seq);

CREATE TABLE IF NOT EXISTS challenge_scores (
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  effective_ms INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  penalty_ms INTEGER NOT NULL,
  mine_hits INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS challenge_scores_ranking_idx ON challenge_scores (challenge_id, effective_ms);

CREATE TABLE IF NOT EXISTS run_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  action TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  result TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS run_actions_sequence_unique ON run_actions (run_id, seq);
CREATE INDEX IF NOT EXISTS run_actions_run_idx ON run_actions (run_id, seq);

CREATE TABLE IF NOT EXISTS match_results (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  winner_user_id TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS match_results_room_unique ON match_results (room_id);
