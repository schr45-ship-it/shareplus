-- 010: contact form messages + admin RPC
-- Run after 009_all_pending.sql

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  locale TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_public_insert ON contact_messages;
CREATE POLICY contact_public_insert ON contact_messages FOR INSERT WITH CHECK (true);

-- Admin: list contact messages
CREATE OR REPLACE FUNCTION admin_contact_messages(p_token TEXT)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT id, name, email, message, locale, is_read, created_at
    FROM contact_messages
    ORDER BY created_at DESC
    LIMIT 200
  ) row;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: mark a message read/unread
CREATE OR REPLACE FUNCTION admin_mark_message(
  p_token TEXT,
  p_message UUID,
  p_read BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE contact_messages SET is_read = p_read WHERE id = p_message;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
