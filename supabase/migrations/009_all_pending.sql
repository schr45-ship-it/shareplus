-- 009: consolidated pending migrations (006+007+008), idempotent
-- Run this single file in the Supabase SQL Editor.

-- 006: subcategories table + article subcategory + updated RPCs
-- Run after 005_categories_and_add.sql

CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subcategories_public_read ON subcategories;
CREATE POLICY subcategories_public_read ON subcategories
  FOR SELECT USING (true);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS subcategory_id UUID
  REFERENCES subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_subcategory ON articles(subcategory_id);

-- Seed subcategories under their parent categories
WITH cat AS (SELECT id, slug FROM categories)
INSERT INTO subcategories (category_id, slug, name_json)
SELECT cat.id, s.slug, s.names::jsonb
FROM cat
JOIN (VALUES
  ('technology', 'ai',            '{"en":"AI & Machine Learning","he":"בינה מלאכותית","es":"IA y aprendizaje automático","ar":"الذكاء الاصطناعي"}'),
  ('technology', 'gadgets',       '{"en":"Gadgets & Hardware","he":"גאדג''טים וחומרה","es":"Gadgets y hardware","ar":"أدوات وأجهزة"}'),
  ('technology', 'cybersecurity', '{"en":"Cybersecurity","he":"סייבר ואבטחת מידע","es":"Ciberseguridad","ar":"الأمن السيبراني"}'),
  ('business',   'markets',       '{"en":"Markets & Investing","he":"שוק ההון והשקעות","es":"Mercados e inversión","ar":"الأسواق والاستثمار"}'),
  ('business',   'startups',      '{"en":"Startups & Entrepreneurship","he":"יזמות וסטארטאפים","es":"Startups y emprendimiento","ar":"الشركات الناشئة وريادة الأعمال"}'),
  ('business',   'global-economy','{"en":"Global Economy","he":"כלכלה גלובלית","es":"Economía global","ar":"الاقتصاد العالمي"}'),
  ('science',    'space',         '{"en":"Space & Astronomy","he":"חלל ואסטרונומיה","es":"Espacio y astronomía","ar":"الفضاء والفلك"}'),
  ('science',    'biotech',       '{"en":"Medicine & Biotech","he":"רפואה וביוטק","es":"Medicina y biotecnología","ar":"الطب والتكنولوجيا الحيوية"}'),
  ('science',    'environment',   '{"en":"Environment & Green Energy","he":"סביבה ואנרגיה ירוקה","es":"Medio ambiente y energía verde","ar":"البيئة والطاقة الخضراء"}'),
  ('politics',   'domestic',      '{"en":"Domestic Politics","he":"חדשות מדיניות","es":"Política nacional","ar":"السياسة الداخلية"}'),
  ('politics',   'foreign',       '{"en":"Foreign Relations","he":"יחסי חוץ","es":"Relaciones exteriores","ar":"العلاقات الخارجية"}'),
  ('entertainment','film-tv',     '{"en":"Film & TV","he":"קולנוע וטלוויזיה","es":"Cine y televisión","ar":"السينما والتلفزيون"}'),
  ('entertainment','gaming',      '{"en":"Gaming","he":"גיימינג","es":"Videojuegos","ar":"ألعاب الفيديو"}'),
  ('health',     'nutrition',     '{"en":"Nutrition & Fitness","he":"תזונה וכושר","es":"Nutrición y fitness","ar":"التغذية واللياقة"}'),
  ('health',     'mental',        '{"en":"Mental Health & Mindfulness","he":"בריאות הנפש ומיינדפולנס","es":"Salud mental y mindfulness","ar":"الصحة النفسية واليقظة"}'),
  ('sports',     'football',      '{"en":"Football / Soccer","he":"כדורגל","es":"Fútbol","ar":"كرة القدم"}'),
  ('sports',     'other-sports',  '{"en":"Other Sports","he":"ענפי ספורט אחרים","es":"Otros deportes","ar":"رياضات أخرى"}'),
  ('world',      'conflict',      '{"en":"Conflicts & Security","he":"עימותים וביטחון","es":"Conflictos y seguridad","ar":"النزاعات والأمن"}'),
  ('world',      'diplomacy',     '{"en":"Diplomacy & Agreements","he":"דיפלומטיה והסכמים","es":"Diplomacia y acuerdos","ar":"الدبلوماسية والاتفاقيات"}')
) AS s(parent_slug, slug, names) ON s.parent_slug = cat.slug
ON CONFLICT (category_id, slug) DO NOTHING;

-- get_latest_articles: include subcategory info (drop needed to change return type)
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
  ORDER BY a.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;


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


-- 008: media category + movie/video subcategories + free-movie YouTube sources
-- Run after 007_reports.sql

-- Ensure the media category exists
INSERT INTO categories (slug, name_json, description_json, color, is_active)
VALUES
  ('media',
   '{"en":"Media","he":"מדיה","es":"Medios","ar":"وسائط"}'::jsonb,
   '{"en":"Videos and full movies from YouTube","he":"סרטונים וסרטים מלאים מיוטיוב","es":"Videos y películas completas de YouTube","ar":"مقاطع فيديو وأفلام كاملة من يوتيوب"}'::jsonb,
   '#8b5cf6', true)
ON CONFLICT (slug) DO UPDATE SET
  name_json = EXCLUDED.name_json,
  description_json = EXCLUDED.description_json,
  color = EXCLUDED.color,
  is_active = true;

-- Subcategories under media
INSERT INTO subcategories (category_id, slug, name_json)
SELECT c.id, s.slug, s.names::jsonb
FROM categories c
JOIN (VALUES
  ('videos',      '{"en":"Videos","he":"סרטונים","es":"Videos","ar":"مقاطع فيديو"}'),
  ('movies',      '{"en":"Movies","he":"סרטים","es":"Películas","ar":"أفلام"}'),
  ('kids-movies', '{"en":"Kids Movies","he":"סרטים לילדים","es":"Películas para niños","ar":"أفلام للأطفال"}')
) AS s(slug, names) ON c.slug = 'media'
ON CONFLICT (category_id, slug) DO NOTHING;

-- Free full-movie / kids YouTube sources (auto-resolved by channel handle)
INSERT INTO sources (name, source_type, url, language, category_id, is_active)
SELECT s.name, 'youtube', s.url, 'en', c.id, true
FROM (VALUES
  ('FilmRise Movies',       'https://www.youtube.com/@FilmRiseMovies'),
  ('Popcornflix',           'https://www.youtube.com/@popcornflix'),
  ('PizzaFlix',             'https://www.youtube.com/@pizzaflix'),
  ('Cult Cinema Classics',  'https://www.youtube.com/@CultCinemaClassics'),
  ('WildBrain Kids',        'https://www.youtube.com/@WildBrain')
) AS s(name, url)
JOIN categories c ON c.slug = 'media'
WHERE NOT EXISTS (SELECT 1 FROM sources ex WHERE ex.url = s.url);

-- Admin: update an article's image URL (fixes corrupted/duplicate images)
CREATE OR REPLACE FUNCTION admin_set_article_image(
  p_token TEXT,
  p_article UUID,
  p_url TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE articles SET featured_image_url = p_url WHERE id = p_article;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: create a subcategory from the dashboard
CREATE OR REPLACE FUNCTION admin_add_subcategory(
  p_token TEXT,
  p_category_slug TEXT,
  p_slug TEXT,
  p_name_json JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'invalid slug';
  END IF;
  IF p_name_json IS NULL OR p_name_json->>'en' IS NULL THEN
    RAISE EXCEPTION 'name_json must include at least "en"';
  END IF;
  INSERT INTO subcategories (category_id, slug, name_json, is_active)
  SELECT c.id, p_slug, p_name_json, true
  FROM categories c WHERE c.slug = p_category_slug
  ON CONFLICT (category_id, slug) DO NOTHING;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
