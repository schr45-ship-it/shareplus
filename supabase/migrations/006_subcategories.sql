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
