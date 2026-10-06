-- 014: efficient gallery pagination

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
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    at.title,
    at.seo_slug,
    a.published_at,
    a.featured_image_url,
    c.slug,
    c.name_json,
    COUNT(*) OVER() AS total_count
  FROM article_translations at
  JOIN articles a ON a.id = at.article_id
  JOIN categories c ON c.id = a.category_id
  WHERE at.language = p_language
    AND a.status = 'published'
    AND a.featured_image_url IS NOT NULL
    AND a.featured_image_url <> ''
    AND c.is_active = true
  ORDER BY a.published_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
END;
$$ LANGUAGE plpgsql STABLE;
