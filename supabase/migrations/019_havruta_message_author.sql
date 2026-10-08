-- 019: Havruta — author name per message (shared discussions)
ALTER TABLE havruta_messages ADD COLUMN IF NOT EXISTS author_name TEXT;
