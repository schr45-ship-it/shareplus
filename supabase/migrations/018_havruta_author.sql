-- 018: Havruta — display author name on discussions
ALTER TABLE havruta_sessions ADD COLUMN IF NOT EXISTS author_name TEXT;
