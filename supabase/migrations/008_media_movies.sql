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
