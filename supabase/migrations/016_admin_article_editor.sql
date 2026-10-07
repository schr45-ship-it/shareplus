-- 016: admin article editor + search
-- Run after 015_block_tags.sql

-- ============================================================
-- Admin: fetch full article details for editing
-- ============================================================

CREATE OR REPLACE FUNCTION admin_get_article(
  p_token TEXT,
  p_article_id UUID,
  p_language VARCHAR(5) DEFAULT 'he'
)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'article_id', a.id,
    'language', at.language,
    'title', at.title,
    'body', COALESCE(at.summary->>'body', at.summary->>'executive_summary', ''),
    'executive_summary', at.summary->>'executive_summary',
    'key_takeaways', COALESCE(at.summary->'key_takeaways', '[]'::jsonb),
    'tags', at.tags,
    'status', a.status,
    'category_slug', c.slug,
    'subcategory_slug', sc.slug,
    'featured_image_url', a.featured_image_url,
    'source_url', a.source_url,
    'source_type', a.source_type,
    'published_at', a.published_at,
    'available_languages', ARRAY(
      SELECT at2.language
      FROM article_translations at2
      WHERE at2.article_id = a.id
      ORDER BY at2.language
    )
  ) INTO result
  FROM articles a
  JOIN article_translations at ON at.article_id = a.id
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
  WHERE a.id = p_article_id AND at.language = p_language;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Admin: update article content, category, image, and status
-- ============================================================

CREATE OR REPLACE FUNCTION admin_update_article(
  p_token TEXT,
  p_article_id UUID,
  p_language VARCHAR(5),
  p_title TEXT,
  p_body TEXT,
  p_tags TEXT[],
  p_category_slug TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_category_id UUID;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_category_slug IS NOT NULL THEN
    SELECT id INTO v_category_id
    FROM categories
    WHERE slug = p_category_slug;
  END IF;

  UPDATE article_translations
  SET
    title = p_title,
    summary = jsonb_set(
      COALESCE(summary, '{}'::jsonb),
      '{body}',
      to_jsonb(p_body)
    ),
    tags = COALESCE(p_tags, tags)
  WHERE article_id = p_article_id AND language = p_language;

  UPDATE articles
  SET
    category_id = COALESCE(v_category_id, category_id),
    featured_image_url = COALESCE(p_image_url, featured_image_url),
    status = COALESCE(p_status, status)
  WHERE id = p_article_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Admin: search articles by title, slug, or source URL
-- ============================================================

CREATE OR REPLACE FUNCTION admin_search_articles(
  p_token TEXT,
  p_query TEXT,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT
      a.id,
      a.status,
      a.source_type,
      a.published_at,
      a.created_at,
      a.source_url,
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
      a.raw_metadata->>'youtube_video_id' AS youtube_video_id,
      sc.slug AS subcategory_slug,
      sc.name_json AS subcategory_name
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
    LEFT JOIN article_stats s ON s.article_id = a.id
    WHERE
      EXISTS (
        SELECT 1 FROM article_translations at
        WHERE at.article_id = a.id
          AND (
            at.title ILIKE '%' || p_query || '%'
            OR at.seo_slug ILIKE '%' || p_query || '%'
          )
      )
      OR a.source_url ILIKE '%' || p_query || '%'
    ORDER BY a.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) row;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
