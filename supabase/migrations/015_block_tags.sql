-- 015: block articles by tag from all public views
-- Run after 014_gallery_pagination.sql

-- ============================================================
-- blocked_tags table
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_tags (
  tag TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE blocked_tags IS 'Tags whose articles should be hidden from public site, search, sitemap, and feeds.';

-- Public cannot read, modify, or insert blocked tags
ALTER TABLE blocked_tags ENABLE ROW LEVEL SECURITY;

-- Public read-only so static generation / sitemap can exclude blocked tags.
DROP POLICY IF EXISTS blocked_tags_public_read ON blocked_tags;
CREATE POLICY blocked_tags_public_read ON blocked_tags
  FOR SELECT TO anon USING (true);

-- Only the admin RPCs (SECURITY DEFINER) can insert/update/delete.

-- Seed default blocked tags (case-insensitive matching is applied by helper)
INSERT INTO blocked_tags (tag, reason) VALUES
  ('פורנהאב', 'Pornographic source'),
  ('pornhub', 'Pornographic source'),
  ('porn', 'Pornographic content'),
  ('pornographic', 'Pornographic content'),
  ('sex', 'Sexual content'),
  ('adult', 'Adult content')
ON CONFLICT (tag) DO NOTHING;

-- ============================================================
-- Helper: does an article contain a blocked tag?
-- Case-insensitive; tags array vs blocked_tags table.
-- ============================================================
CREATE OR REPLACE FUNCTION article_has_blocked_tag(p_tags TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS t(tag_text)
    WHERE LOWER(t.tag_text) = ANY(
      SELECT LOWER(tag) FROM blocked_tags
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- Update public-facing functions to exclude blocked-tag articles
-- ============================================================

-- get_latest_articles
DROP FUNCTION IF EXISTS get_latest_articles(VARCHAR(5), TEXT, INT, INT);
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
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
    AND NOT article_has_blocked_tag(at.tags)
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_article_by_slug
CREATE OR REPLACE FUNCTION get_article_by_slug(
  p_language VARCHAR(5),
  p_slug TEXT
)
RETURNS TABLE (
  article_id UUID,
  language VARCHAR(5),
  title TEXT,
  seo_slug TEXT,
  seo_meta_title TEXT,
  seo_meta_description TEXT,
  summary JSONB,
  tags TEXT[],
  source_url TEXT,
  source_type TEXT,
  original_language VARCHAR(5),
  published_at TIMESTAMPTZ,
  featured_image_url TEXT,
  category_slug TEXT,
  category_name JSONB,
  author TEXT,
  video_duration_seconds INT,
  available_languages VARCHAR(5)[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS article_id,
    at.language,
    at.title,
    at.seo_slug,
    at.seo_meta_title,
    at.seo_meta_description,
    at.summary,
    at.tags,
    a.source_url,
    a.source_type,
    a.original_language,
    a.published_at,
    a.featured_image_url,
    c.slug AS category_slug,
    c.name_json AS category_name,
    a.author,
    a.video_duration_seconds,
    ARRAY(
      SELECT at2.language
      FROM article_translations at2
      WHERE at2.article_id = a.id
      ORDER BY at2.language
    ) AS available_languages
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND at.seo_slug = p_slug
    AND a.status = 'published'
    AND NOT article_has_blocked_tag(at.tags)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- search_articles
CREATE OR REPLACE FUNCTION search_articles(
  p_language VARCHAR(5),
  p_query TEXT,
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
  status TEXT,
  published_at TIMESTAMPTZ,
  category_slug TEXT,
  category_name JSONB,
  rank REAL
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
    a.status,
    a.published_at,
    c.slug AS category_slug,
    c.name_json AS category_name,
    ts_rank(
      to_tsvector('simple', at.title || ' ' || COALESCE(at.summary->>'body', '') || ' ' || COALESCE(at.summary->>'executive_summary', '')),
      plainto_tsquery('simple', p_query)
    )::REAL AS rank
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND (
      to_tsvector('simple', at.title || ' ' || COALESCE(at.summary->>'body', '') || ' ' || COALESCE(at.summary->>'executive_summary', ''))
      @@ plainto_tsquery('simple', p_query)
    )
    AND NOT article_has_blocked_tag(at.tags)
  ORDER BY rank DESC, a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_articles_by_tag
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
    AND NOT article_has_blocked_tag(at.tags)
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_popular_tags
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
  WHERE at.language = p_language
    AND a.status = 'published'
    AND NOT article_has_blocked_tag(at.tags)
    AND NOT EXISTS (
      SELECT 1 FROM blocked_tags bt WHERE LOWER(bt.tag) = LOWER(t.tag)
    )
  GROUP BY t.tag
  ORDER BY count DESC, t.tag
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_popular_articles
CREATE OR REPLACE FUNCTION get_popular_articles(
  p_language VARCHAR(5),
  p_limit INT DEFAULT 10,
  p_category_slug TEXT DEFAULT NULL
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
  views INT
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
    COALESCE(s.views, 0) AS views
  FROM articles a
  JOIN article_translations at ON at.article_id = a.id
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN article_stats s ON s.article_id = a.id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
    AND NOT article_has_blocked_tag(at.tags)
  ORDER BY COALESCE(s.views, 0) DESC, a.published_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_gallery_articles
CREATE OR REPLACE FUNCTION get_gallery_articles(
  p_language VARCHAR(5),
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  article_id UUID,
  title TEXT,
  seo_slug TEXT,
  published_at TIMESTAMPTZ,
  featured_image_url TEXT,
  category_slug TEXT,
  category_name JSONB,
  total_count BIGINT
) AS $$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND a.featured_image_url IS NOT NULL
    AND COALESCE(c.is_active, true)
    AND NOT article_has_blocked_tag(at.tags);

  RETURN QUERY
  SELECT
    a.id AS article_id,
    at.title,
    at.seo_slug,
    a.published_at,
    a.featured_image_url,
    c.slug AS category_slug,
    c.name_json AS category_name,
    v_total AS total_count
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND a.featured_image_url IS NOT NULL
    AND COALESCE(c.is_active, true)
    AND NOT article_has_blocked_tag(at.tags)
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Public category counts (excludes blocked-tag articles)
-- ============================================================

CREATE OR REPLACE FUNCTION get_category_counts(p_language VARCHAR(5))
RETURNS TABLE (category_slug TEXT, published_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT c.slug AS category_slug, COUNT(*)::BIGINT AS published_count
  FROM articles a
  JOIN article_translations at ON at.article_id = a.id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND COALESCE(c.is_active, true)
    AND NOT article_has_blocked_tag(at.tags)
  GROUP BY c.slug;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Admin RPCs for managing blocked tags
-- ============================================================

CREATE OR REPLACE FUNCTION admin_blocked_tags(p_token TEXT)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT tag, reason, created_at
    FROM blocked_tags
    ORDER BY created_at DESC
  ) row;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_block_tag(
  p_token TEXT,
  p_tag TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_tag IS NULL OR TRIM(p_tag) = '' THEN
    RAISE EXCEPTION 'invalid tag';
  END IF;
  INSERT INTO blocked_tags (tag, reason)
  VALUES (TRIM(p_tag), COALESCE(NULLIF(TRIM(p_reason), ''), NULL))
  ON CONFLICT (tag) DO UPDATE SET reason = EXCLUDED.reason;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_unblock_tag(
  p_token TEXT,
  p_tag TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  DELETE FROM blocked_tags WHERE LOWER(tag) = LOWER(TRIM(p_tag));
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
