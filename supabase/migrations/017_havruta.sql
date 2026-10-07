-- 017: Havruta AI — saved study discussions
-- All access is through /api/havruta (service role) — tables are private.

CREATE TABLE IF NOT EXISTS havruta_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  source_text TEXT,
  locale VARCHAR(5) NOT NULL DEFAULT 'he',
  message_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS havruta_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES havruta_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS havruta_messages_session_idx
  ON havruta_messages (session_id, created_at);

ALTER TABLE havruta_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE havruta_messages ENABLE ROW LEVEL SECURITY;

-- No public policies: reads/writes go through the API route with the service key.
