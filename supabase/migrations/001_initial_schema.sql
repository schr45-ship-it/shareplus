-- ============================================================
-- ai-shareplus: Initial Database Schema
-- Supports: articles, translations, categories, sources, logs, stats
-- Created: 2026-10-01
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_json JSONB NOT NULL,
  description_json JSONB DEFAULT '{}',
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN categories.name_json IS 'Localized names e.g. {"he":"טכנולוגיה","en":"Technology","es":"Tecnología","ar":"تكنولوجيا"}';
COMMENT ON COLUMN categories.description_json IS 'Localized SEO descriptions per language';

-- ============================================================
-- sources
-- ============================================================
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'youtube')),
  url TEXT NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sources_active ON sources(is_active);

-- ============================================================
-- articles
-- ============================================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('news', 'video')),
  original_language VARCHAR(5) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Deduplication
  canonical_url TEXT,
  content_hash TEXT UNIQUE,

  -- Metadata
  featured_image_url TEXT,
  video_duration_seconds INT,
  author TEXT,
  published_date TIMESTAMPTZ,
  raw_metadata JSONB DEFAULT '{}',

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'extracting',
      'summarizing',
      'translating',
      'published',
      'rejected',
      'archived',
      'failed'
    )),

  processing_started_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_source_url ON articles(source_url);
CREATE INDEX idx_articles_content_hash ON articles(content_hash);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_status_published_at ON articles(status, published_at DESC);

-- ============================================================
-- article_translations
-- ============================================================
CREATE TABLE article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL,

  title TEXT NOT NULL,
  seo_slug TEXT NOT NULL,
  seo_meta_title TEXT,
  seo_meta_description TEXT,

  summary JSONB NOT NULL DEFAULT '{}',
  -- Expected JSON shape:
  -- {
  --   "executive_summary": "...",
  --   "key_takeaways": ["...", "..."],
  --   "body": "..."
  -- }

  tags TEXT[] DEFAULT '{}',
  word_count INT,

  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(article_id, language)
);

CREATE INDEX idx_article_translations_article ON article_translations(article_id);
CREATE INDEX idx_article_translations_language ON article_translations(language);
CREATE INDEX idx_article_translations_slug ON article_translations(seo_slug);
CREATE INDEX idx_article_translations_primary ON article_translations(article_id, is_primary);

-- Full-text search indexes
CREATE INDEX idx_article_translations_title_fts ON article_translations
  USING gin(to_tsvector('simple', title));

CREATE INDEX idx_article_translations_summary_fts ON article_translations
  USING gin(to_tsvector('simple', COALESCE(summary->>'body', '') || ' ' || COALESCE(summary->>'executive_summary', '')));

-- ============================================================
-- processing_logs
-- ============================================================
CREATE TABLE processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  step TEXT NOT NULL CHECK (step IN ('fetch', 'extract', 'dedupe', 'summarize', 'translate', 'publish', 'error', 'revalidate')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_processing_logs_article ON processing_logs(article_id);
CREATE INDEX idx_processing_logs_created ON processing_logs(created_at DESC);

-- ============================================================
-- article_stats
-- ============================================================
CREATE TABLE article_stats (
  article_id UUID PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  clicks_to_source INT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Functions & Triggers
-- ============================================================

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER article_translations_updated_at BEFORE UPDATE ON article_translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER article_stats_updated_at BEFORE UPDATE ON article_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Set published_at automatically when status becomes published
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_published_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_published_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_stats ENABLE ROW LEVEL SECURITY;

-- Categories: public read
CREATE POLICY "anon_read_categories" ON categories
  FOR SELECT TO anon USING (true);

-- Sources: public read (only active sources metadata)
CREATE POLICY "anon_read_sources" ON sources
  FOR SELECT TO anon USING (is_active = true);

-- Articles: public read only published
CREATE POLICY "anon_read_published_articles" ON articles
  FOR SELECT TO anon USING (status = 'published');

-- Translations: public read only for published articles
CREATE POLICY "anon_read_published_translations" ON article_translations
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_translations.article_id
        AND articles.status = 'published'
    )
  );

-- Stats: public read only
CREATE POLICY "anon_read_article_stats" ON article_stats
  FOR SELECT TO anon USING (true);

-- Processing logs: hidden from public
-- No anon policies on processing_logs

-- service_role bypasses RLS by default

-- ============================================================
-- Helper Functions for Frontend
-- ============================================================

-- Search articles by language
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
  ORDER BY rank DESC, a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get latest articles by category
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
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get single article by slug and language
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
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
