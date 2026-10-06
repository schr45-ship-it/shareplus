-- 011: manually requested AI articles from the admin dashboard
-- Run after 010_contact.sql

CREATE OR REPLACE FUNCTION admin_create_article_request(
  p_token TEXT,
  p_topic TEXT,
  p_language VARCHAR(5) DEFAULT 'he',
  p_long BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_topic TEXT := trim(p_topic);
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF char_length(v_topic) < 3 OR char_length(v_topic) > 500 THEN
    RAISE EXCEPTION 'topic must contain 3-500 characters';
  END IF;

  IF p_language NOT IN ('he', 'en', 'es', 'ar') THEN
    RAISE EXCEPTION 'unsupported language';
  END IF;

  INSERT INTO articles (
    id,
    source_url,
    source_type,
    original_language,
    canonical_url,
    content_hash,
    author,
    raw_metadata,
    status
  ) VALUES (
    v_id,
    'https://www.shareplusai.com/' || p_language,
    'news',
    p_language,
    NULL,
    md5(v_id::text || ':' || v_topic),
    'SharePlus AI',
    jsonb_build_object(
      'manual_request', true,
      'manual_topic', v_topic,
      'title', v_topic,
      'description', v_topic,
      'force_long', p_long
    ),
    'pending'
  );

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
