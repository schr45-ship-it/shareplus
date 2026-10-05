-- 007: content reports (visitors flag inappropriate content; admin reviews)
-- Run after 006_subcategories.sql

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'inappropriate',
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_public_insert ON reports;
CREATE POLICY reports_public_insert ON reports FOR INSERT WITH CHECK (true);

-- Admin: pending reports with article info
CREATE OR REPLACE FUNCTION admin_reports(p_token TEXT)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT
      r.id, r.article_id, r.reason, r.details, r.status, r.created_at,
      a.status AS article_status, a.source_type, a.source_url, a.featured_image_url,
      (SELECT at.title FROM article_translations at
        WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS title_he,
      (SELECT at.seo_slug FROM article_translations at
        WHERE at.article_id = a.id AND at.language = 'he' LIMIT 1) AS slug_he,
      c.slug AS category_slug
    FROM reports r
    JOIN articles a ON a.id = r.article_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE r.status = 'pending'
  ) row;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: mark a report reviewed (optionally also change article status)
CREATE OR REPLACE FUNCTION admin_resolve_report(
  p_token TEXT,
  p_report UUID,
  p_article_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE reports SET status = 'reviewed' WHERE id = p_report;
  IF p_article_status IS NOT NULL THEN
    UPDATE articles SET status = p_article_status
    WHERE id = (SELECT article_id FROM reports WHERE id = p_report);
  END IF;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
