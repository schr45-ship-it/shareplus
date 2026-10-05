-- ============================================================
-- ai-shareplus: Admin dashboard — media-type stats
-- Adds news/video breakdown and source_type to recent articles
-- ============================================================

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
      'clicks', (SELECT COALESCE(sum(clicks_to_source), 0) FROM article_stats),
      'videos', (SELECT count(*) FROM articles WHERE source_type = 'video'),
      'videos_published', (SELECT count(*) FROM articles WHERE source_type = 'video' AND status = 'published'),
      'news', (SELECT count(*) FROM articles WHERE source_type = 'news')
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
          a.id, a.status, a.source_type, a.published_at, a.created_at, a.source_url,
          c.slug AS category_slug,
          a.source_id,
          (SELECT so.name FROM sources so WHERE so.id = a.source_id) AS source_name,
          (SELECT at.title FROM article_translations at
            WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS title_he,
          (SELECT at.title FROM article_translations at
            WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS title_en,
          (SELECT at.seo_slug FROM article_translations at
            WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS slug_he,
          (SELECT at.seo_slug FROM article_translations at
            WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS slug_en,
          COALESCE(s.views, 0) AS views,
          COALESCE(s.clicks_to_source, 0) AS clicks,
          a.featured_image_url,
          a.raw_metadata->>'youtube_video_id' AS youtube_video_id
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN article_stats s ON s.article_id = a.id
        ORDER BY a.created_at DESC
        LIMIT 500
      ) row
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
