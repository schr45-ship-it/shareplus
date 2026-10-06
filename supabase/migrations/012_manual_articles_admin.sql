-- 012: list editor-requested AI articles in the admin dashboard
-- Run after 011_manual_articles.sql

CREATE OR REPLACE FUNCTION admin_manual_articles(
  p_token TEXT,
  p_limit INT DEFAULT 100
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      a.id,
      a.status,
      a.original_language,
      a.created_at,
      a.published_at,
      a.featured_image_url,
      a.raw_metadata->>'manual_topic' AS requested_topic,
      COALESCE((a.raw_metadata->>'force_long')::boolean, false) AS requested_long,
      a.raw_metadata->>'processing_error' AS processing_error,
      c.slug AS category_slug,
      (SELECT at.title FROM article_translations at
        WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS title_he,
      (SELECT at.title FROM article_translations at
        WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS title_en,
      (SELECT at.seo_slug FROM article_translations at
        WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS slug_he,
      (SELECT at.seo_slug FROM article_translations at
        WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS slug_en
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.raw_metadata->>'manual_request' = 'true'
    ORDER BY a.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
  ) row;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
