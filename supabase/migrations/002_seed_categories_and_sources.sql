-- ============================================================
-- ai-shareplus: Seed categories and sample sources
-- ============================================================

INSERT INTO categories (slug, name_json, description_json, color) VALUES
  ('technology', '{"he":"טכנולוגיה","en":"Technology","es":"Tecnología","ar":"تكنولوجيا"}', '{"he":"חדשות טכנולוגיה, AI וחדשנות","en":"Technology, AI and innovation news","es":"Noticias de tecnología, IA e innovación","ar":"أخبار التكنولوجيا والذكاء الاصطناعي والابتكار"}', '#3b82f6'),
  ('business', '{"he":"עסקים","en":"Business","es":"Negocios","ar":"أعمال"}', '{"he":"חדשות עסקים, כלכלה ושוק ההון","en":"Business, economy and market news","es":"Noticias de negocios, economía y mercados","ar":"أخبار الأعمال والاقتصاد والأسواق"}', '#10b981'),
  ('science', '{"he":"מדע","en":"Science","es":"Ciencia","ar":"علوم"}', '{"he":"גילויים, מחקרים וחדשות מדע","en":"Discoveries, research and science news","es":"Descubrimientos, investigaciones y ciencia","ar":"اكتشافات وأبحاث وأخبار العلوم"}', '#8b5cf6'),
  ('health', '{"he":"בריאות","en":"Health","es":"Salud","ar":"صحة"}', '{"he":"בריאות, רפואה ואורח חיים","en":"Health, medicine and wellness","es":"Salud, medicina y bienestar","ar":"الصحة والطب والعافية"}', '#ef4444'),
  ('world', '{"he":"עולם","en":"World","es":"Mundo","ar":"العالم"}', '{"he":"חדשות בינלאומיות ומדיניות","en":"International and political news","es":"Noticias internacionales y política","ar":"أخبار دولية وسياسية"}', '#f59e0b'),
  ('entertainment', '{"he":"בידור","en":"Entertainment","es":"Entretenimiento","ar":"ترفيه"}', '{"he":"בידור, קולנוע ותרבות","en":"Entertainment, movies and culture","es":"Entretenimiento, cine y cultura","ar":"ترفيه وسينما وثقافة"}', '#ec4899');

-- Sample RSS sources (replace URLs with real feeds)
INSERT INTO sources (name, source_type, url, language, category_id) VALUES
  ('TechCrunch', 'rss', 'https://techcrunch.com/feed/', 'en', (SELECT id FROM categories WHERE slug = 'technology')),
  ('The Verge', 'rss', 'https://www.theverge.com/rss/index.xml', 'en', (SELECT id FROM categories WHERE slug = 'technology')),
  ('BBC Business', 'rss', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'en', (SELECT id FROM categories WHERE slug = 'business')),
  ('Reuters Tech', 'rss', 'https://www.reuters.com/technology/rss/', 'en', (SELECT id FROM categories WHERE slug = 'technology'));

-- Sample YouTube sources (replace url with channel ID or @handle)
INSERT INTO sources (name, source_type, url, language, category_id) VALUES
  ('MKBHD', 'youtube', 'UCBJycsmduvYEL83R_U4JriQ', 'en', (SELECT id FROM categories WHERE slug = 'technology')),
  ('Linus Tech Tips', 'youtube', 'UCXuqSBlHAE6Xw-yeJA0Tunw', 'en', (SELECT id FROM categories WHERE slug = 'technology'));
