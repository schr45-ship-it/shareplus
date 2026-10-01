-- ============================================================
-- ai-shareplus: Analytics / View Tracking Functions
-- ============================================================

-- Increment article views (creates row if missing)
CREATE OR REPLACE FUNCTION increment_article_views(p_article_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO article_stats (article_id, views, last_viewed_at, updated_at)
  VALUES (p_article_id, 1, now(), now())
  ON CONFLICT (article_id)
  DO UPDATE SET
    views = article_stats.views + 1,
    last_viewed_at = now(),
    updated_at = now();
END;
$$;

-- Increment clicks to source (creates row if missing)
CREATE OR REPLACE FUNCTION increment_article_clicks(p_article_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO article_stats (article_id, clicks_to_source, last_viewed_at, updated_at)
  VALUES (p_article_id, 1, now(), now())
  ON CONFLICT (article_id)
  DO UPDATE SET
    clicks_to_source = article_stats.clicks_to_source + 1,
    updated_at = now();
END;
$$;

-- Get popular articles by views (optionally filtered by category)
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
  ORDER BY COALESCE(s.views, 0) DESC, a.published_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
