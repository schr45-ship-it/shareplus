-- 022: Admin vault — private store of sites, systems, credentials & notes
-- Access only through /api/vault (service role + admin token). No public policies.

CREATE TABLE IF NOT EXISTS admin_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  username TEXT,
  secret TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_vault ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_vault_category_idx
  ON admin_vault (category, sort_order, name);
