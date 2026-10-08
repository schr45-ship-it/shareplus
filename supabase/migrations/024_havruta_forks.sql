-- 024: Discussion forks — a session can branch off from another session
ALTER TABLE havruta_sessions
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES havruta_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS havruta_sessions_parent_idx
  ON havruta_sessions (parent_session_id);
