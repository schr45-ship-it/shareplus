-- 005: politics + misc categories, admin_add_category RPC
-- Run after 004_admin_media.sql

INSERT INTO categories (slug, name_json, description_json, color, is_active)
VALUES
  ('politics',
   '{"en":"Politics","he":"פוליטיקה","es":"Política","ar":"سياسة"}'::jsonb,
   '{"en":"Politics, elections and government news","he":"פוליטיקה, בחירות וממשלה","es":"Política, elecciones y gobierno","ar":"سياسة وانتخابات وحكومة"}'::jsonb,
   '#dc2626', true),
  ('other',
   '{"en":"Other","he":"שונות","es":"Varios","ar":"متنوعات"}'::jsonb,
   '{"en":"Miscellaneous stories","he":"כתבות שונות","es":"Historias varias","ar":"قصص متنوعة"}'::jsonb,
   '#6b7280', true)
ON CONFLICT (slug) DO NOTHING;

-- Allow admin to create new categories from the dashboard
CREATE OR REPLACE FUNCTION admin_add_category(
  p_token TEXT,
  p_slug TEXT,
  p_name_json JSONB,
  p_color TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT admin_check(p_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_slug IS NULL OR p_slug = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'invalid slug (lowercase letters, numbers, hyphens only)';
  END IF;
  IF p_name_json IS NULL OR p_name_json->>'en' IS NULL THEN
    RAISE EXCEPTION 'name_json must include at least "en"';
  END IF;
  INSERT INTO categories (slug, name_json, color, is_active)
  VALUES (p_slug, p_name_json, COALESCE(p_color, '#3b82f6'), true)
  ON CONFLICT (slug) DO NOTHING;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
