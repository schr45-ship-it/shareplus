-- ============================================================
-- ai-shareplus: Media support
-- Exposes youtube_video_id for video embeds on article pages
-- ============================================================

DROP FUNCTION IF EXISTS get_article_by_slug(varchar(5), text);

CREATE FUNCTION get_article_by_slug(
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
  available_languages VARCHAR(5)[],
  youtube_video_id TEXT
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
    ) AS available_languages,
    a.raw_metadata->>'youtube_video_id' AS youtube_video_id
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  LEFT JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND at.seo_slug = p_slug
    AND a.status = 'published'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
