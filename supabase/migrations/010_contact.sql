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

-- Tag pages: articles that have a given tag in a language
CREATE OR REPLACE FUNCTION get_articles_by_tag(
  p_language VARCHAR(5),
  p_tag TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  article_id UUID,
  language VARCHAR(5),
  title TEXT,
  seo_slug TEXT,
  seo_meta_description TEXT,
  summary JSONB,
  tags TEXT[],
  published_at TIMESTAMPTZ,
  category_slug TEXT,
  category_name JSONB,
  featured_image_url TEXT,
  subcategory_slug TEXT,
  subcategory_name JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS article_id,
    at.language,
    at.title,
    at.seo_slug,
    at.seo_meta_description,
    at.summary,
    at.tags,
    a.published_at,
    c.slug AS category_slug,
    c.name_json AS category_name,
    a.featured_image_url,
    sc.slug AS subcategory_slug,
    sc.name_json AS subcategory_name
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND COALESCE(c.is_active, true)
    AND p_tag = ANY(at.tags)
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Popular tags for a language (tag cloud)
CREATE OR REPLACE FUNCTION get_popular_tags(
  p_language VARCHAR(5),
  p_limit INT DEFAULT 20
)
RETURNS TABLE (tag TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tag, COUNT(*)::BIGINT AS count
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  CROSS JOIN LATERAL unnest(at.tags) AS t(tag)
  WHERE at.language = p_language AND a.status = 'published'
  GROUP BY t.tag
  ORDER BY count DESC, t.tag
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

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
