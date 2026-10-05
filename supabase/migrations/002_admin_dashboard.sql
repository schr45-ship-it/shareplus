-- ============================================================
-- ai-shareplus: Admin dashboard support
-- Adds category activation, admin token config, and admin RPCs
-- Run in Supabase SQL Editor, then view the token with:
--   SELECT value FROM admin_config WHERE key = 'admin_token';
-- ============================================================

-- Categories can be enabled/disabled (controls both display and ingestion)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Admin configuration (token-gated RPC access)
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
-- No anon policies: readable only by service_role / SECURITY DEFINER functions

INSERT INTO admin_config (key, value)
VALUES ('admin_token', encode(gen_random_bytes(16), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- Token check helper
CREATE OR REPLACE FUNCTION admin_check(p_token TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_config
    WHERE key = 'admin_token' AND value = p_token
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Full dashboard snapshot
CREATE OR REPLACE FUNCTION admin_overview(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'status_counts', (
      SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
      FROM (SELECT status, count(*) AS cnt FROM articles GROUP BY status) s
    ),
    'totals', jsonb_build_object(
      'articles', (SELECT count(*) FROM articles),
      'published', (SELECT count(*) FROM articles WHERE status = 'published'),
      'pending', (SELECT count(*) FROM articles WHERE status IN ('pending', 'failed')),
      'views', (SELECT COALESCE(sum(views), 0) FROM article_stats),
      'clicks', (SELECT COALESCE(sum(clicks_to_source), 0) FROM article_stats)
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(cat ORDER BY cat.slug), '[]'::jsonb) FROM (
        SELECT
          c.id, c.slug, c.name_json, c.is_active,
          (SELECT count(*) FROM articles a WHERE a.category_id = c.id) AS article_count,
          (SELECT count(*) FROM articles a WHERE a.category_id = c.id AND a.status = 'published') AS published_count,
          (SELECT COALESCE(sum(s.views), 0)
             FROM article_stats s
             JOIN articles a2 ON a2.id = s.article_id
            WHERE a2.category_id = c.id) AS views
        FROM categories c
      ) cat
    ),
    'sources', (
      SELECT COALESCE(jsonb_agg(src ORDER BY src.name), '[]'::jsonb) FROM (
        SELECT
          so.id, so.name, so.source_type, so.url, so.is_active,
          so.last_checked_at, so.last_error,
          (SELECT count(*) FROM articles a WHERE a.source_id = so.id) AS article_count
        FROM sources so
      ) src
    ),
    'recent_articles', (
      SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
        SELECT
          a.id, a.status, a.published_at, a.created_at, a.source_url,
          c.slug AS category_slug,
          (SELECT at.title FROM article_translations at
            WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS title_he,
          (SELECT at.title FROM article_translations at
            WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS title_en,
          COALESCE(s.views, 0) AS views,
          COALESCE(s.clicks_to_source, 0) AS clicks
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN article_stats s ON s.article_id = a.id
        ORDER BY a.created_at DESC
        LIMIT 30
      ) row
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle a source on/off (controls ingestion)
CREATE OR REPLACE FUNCTION admin_set_source_active(
  p_token TEXT,
  p_source UUID,
  p_active BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE sources SET is_active = p_active WHERE id = p_source;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle a category on/off (hides its articles and pauses its sources' intake)
CREATE OR REPLACE FUNCTION admin_set_category_active(
  p_token TEXT,
  p_category UUID,
  p_active BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE categories SET is_active = p_active WHERE id = p_category;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Change an article status (e.g. 'pending' to retry, 'archived' to hide)
CREATE OR REPLACE FUNCTION admin_set_article_status(
  p_token TEXT,
  p_article UUID,
  p_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_status NOT IN ('pending', 'published', 'rejected', 'archived', 'failed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE articles SET status = p_status WHERE id = p_article;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Respect category activation on the public site
CREATE OR REPLACE FUNCTION get_latest_articles(
  p_language VARCHAR(5),
  p_category_slug TEXT DEFAULT NULL,
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
  featured_image_url TEXT
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
    a.featured_image_url
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND COALESCE(c.is_active, true)
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;
