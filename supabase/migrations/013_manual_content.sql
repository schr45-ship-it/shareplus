-- 013: manually authored articles with optional AI translations and media
-- Run after 012_manual_articles_admin.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'manual-article-media',
  'manual-article-media',
  true,
  209715200,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION admin_create_manual_article(
  p_token TEXT,
  p_title TEXT,
  p_body TEXT,
  p_category_slug TEXT,
  p_tags TEXT[] DEFAULT '{}',
  p_image_url TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_youtube_url TEXT DEFAULT NULL,
  p_youtube_video_id TEXT DEFAULT NULL,
  p_translate_languages TEXT[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_category_id UUID;
  v_languages TEXT[];
  v_needs_translation BOOLEAN;
  v_slug TEXT;
  v_source_type TEXT;
  v_source_url TEXT;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF char_length(trim(p_title)) < 3 OR char_length(trim(p_title)) > 180 THEN
    RAISE EXCEPTION 'title must contain 3-180 characters';
  END IF;

  IF char_length(trim(p_body)) < 20 OR char_length(trim(p_body)) > 50000 THEN
    RAISE EXCEPTION 'body must contain 20-50000 characters';
  END IF;

  SELECT id INTO v_category_id
  FROM categories
  WHERE slug = p_category_slug AND is_active = true;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'invalid category';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lang), '{}'::TEXT[])
  INTO v_languages
  FROM unnest(COALESCE(p_translate_languages, '{}'::TEXT[])) lang
  WHERE lang IN ('en', 'es', 'ar');

  v_needs_translation := cardinality(v_languages) > 0;
  v_slug := 'manual-' || left(replace(v_id::text, '-', ''), 16);
  v_source_type := CASE WHEN p_video_url IS NOT NULL OR p_youtube_video_id IS NOT NULL THEN 'video' ELSE 'news' END;
  v_source_url := COALESCE(NULLIF(p_youtube_url, ''), 'https://www.shareplusai.com/he');

  INSERT INTO articles (
    id,
    source_url,
    source_type,
    original_language,
    category_id,
    content_hash,
    featured_image_url,
    author,
    raw_metadata,
    status,
    published_at
  ) VALUES (
    v_id,
    v_source_url,
    v_source_type,
    'he',
    v_category_id,
    md5(v_id::text || ':' || p_title || ':' || p_body),
    NULLIF(p_image_url, ''),
    'SharePlus',
    jsonb_build_object(
      'manual_authored', true,
      'manual_title', trim(p_title),
      'manual_body', trim(p_body),
      'manual_tags', to_jsonb(COALESCE(p_tags, '{}'::TEXT[])),
      'manual_category_slug', p_category_slug,
      'translate_languages', to_jsonb(v_languages),
      'uploaded_video_url', NULLIF(p_video_url, ''),
      'youtube_video_id', NULLIF(p_youtube_video_id, '')
    ),
    CASE WHEN v_needs_translation THEN 'pending' ELSE 'published' END,
    CASE WHEN v_needs_translation THEN NULL ELSE now() END
  );

  INSERT INTO article_translations (
    article_id,
    language,
    title,
    seo_slug,
    seo_meta_title,
    seo_meta_description,
    summary,
    tags,
    word_count,
    is_primary
  ) VALUES (
    v_id,
    'he',
    trim(p_title),
    v_slug,
    left(trim(p_title), 70),
    left(regexp_replace(trim(p_body), E'\\s+', ' ', 'g'), 155),
    jsonb_build_object(
      'executive_summary', left(trim(p_body), 500),
      'body', trim(p_body),
      'key_takeaways', '[]'::jsonb,
      'story', NULL,
      'spoken_language', NULL,
      'video_url', NULLIF(p_video_url, '')
    ),
    COALESCE(p_tags, '{}'::TEXT[]),
    array_length(regexp_split_to_array(trim(p_body), E'\\s+'), 1),
    true
  );

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_manual_articles(
  p_token TEXT,
  p_limit INT DEFAULT 100
)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT
      a.id, a.status, a.original_language, a.created_at, a.published_at,
      a.featured_image_url,
      COALESCE(a.raw_metadata->>'manual_topic', a.raw_metadata->>'manual_title') AS requested_topic,
      COALESCE((a.raw_metadata->>'force_long')::boolean, false) AS requested_long,
      a.raw_metadata->>'processing_error' AS processing_error,
      c.slug AS category_slug,
      (SELECT at.title FROM article_translations at WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS title_he,
      (SELECT at.title FROM article_translations at WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS title_en,
      (SELECT at.seo_slug FROM article_translations at WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS slug_he,
      (SELECT at.seo_slug FROM article_translations at WHERE at.article_id = a.id AND at.language = 'en' LIMIT 1) AS slug_en
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.raw_metadata->>'manual_request' = 'true'
       OR a.raw_metadata->>'manual_authored' = 'true'
    ORDER BY a.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
  ) row;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
