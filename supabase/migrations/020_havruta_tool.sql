-- 020: Havruta — multiple AI tools share the sessions table
ALTER TABLE havruta_sessions ADD COLUMN IF NOT EXISTS tool TEXT NOT NULL DEFAULT 'havruta';
CREATE INDEX IF NOT EXISTS havruta_sessions_tool_idx ON havruta_sessions (tool, updated_at DESC);
