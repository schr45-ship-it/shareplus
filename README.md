# ai-shareplus — AI News & Video Summarizer

Fully automated multi-language content engine powered by Supabase, Next.js 15, n8n, and Gemini/DeepL.

## Project Structure

```
ai-shareplus/
├── PRD-Improved.md          # Improved technical specification
├── README.md                # This file
├── frontend/                # Next.js 15 App Router website
│   ├── app/                 # Pages, sitemap, API routes
│   ├── components/          # React components
│   ├── lib/supabase/        # Supabase client, queries, types
│   ├── i18n/                # next-intl routing
│   ├── messages/            # UI translations (en, he, es, ar)
│   └── env.example          # Environment variables template
├── supabase/
│   └── migrations/            # SQL schema + seed data
└── n8n/
    └── workflows/             # Automation workflow JSONs
        └── README.md
```

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS v4 + next-intl
- **Backend / Database:** Supabase (PostgreSQL)
- **Automation:** n8n self-hosted (or Python worker alternative)
- **AI:** Google Gemini 1.5 Flash (summarization) + DeepL (translation)
- **Hosting:** Vercel (frontend) + VPS (n8n)

## Quick Start

### 1. Supabase Setup

1. Create or open your Supabase project (`ai-shareplus`).
2. Go to **SQL Editor** → **New Query**.
3. Paste and run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_categories_and_sources.sql`
   - `supabase/migrations/003_analytics_functions.sql` (view tracking + popular articles)
4. Enable Row Level Security (RLS) policies are included in the first migration.
5. Copy these keys:
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → used only in n8n credentials

### 2. Frontend Setup

```bash
cd frontend
cp env.example .env.local
# Fill in .env.local with your Supabase keys and site URL
npm install
npm run dev
```

Visit `http://localhost:3000`.

### 3. Vercel Deployment

1. Connect the `frontend` folder to Vercel.
2. Add environment variables from `env.example`.
3. Generate a strong `REVALIDATE_SECRET` and set it in Vercel + n8n.

### 4. n8n Automation

1. **VPS Setup**: Run the automated installer (see `n8n/VPS-SETUP.md`):
   ```bash
   ssh root@YOUR_VPS_IP
   bash vps-install.sh
   ```
   Or follow the manual steps in `n8n/VPS-SETUP.md`.
2. Configure environment variables in `~/n8n/.env`.
3. Start n8n: `cd ~/n8n && docker-compose up -d`.
4. Create a Supabase credential with the `service_role` key.
5. Set n8n environment variables (Settings → Variables).
6. Import workflows from `n8n/workflows/` (see `n8n/WORKFLOWS-IMPORT.md`).
7. Activate all workflows.

## Deployment

See `DEPLOYMENT.md` for full production deployment instructions, including:
- Frontend deployment to Vercel
- n8n deployment on VPS with Docker + Caddy
- Environment variable setup
- Post-deployment verification

Helper files:
- `scripts/deploy-vercel.sh` (Linux/macOS) / `scripts/deploy-vercel.ps1` (Windows)
- `n8n/vps-install.sh` (automated n8n VPS installer)
- `n8n/VPS-SETUP.md` (n8n VPS setup guide)
- `n8n/WORKFLOWS-IMPORT.md` (import and activate workflows)

## Environment Variables

See `frontend/env.example` and `n8n/README.md` for full list.

### Frontend

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
REVALIDATE_SECRET=generate-a-strong-random-secret

# Google AdSense (ca-pub-XXXXXXXXXXXXXXXX)
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX

# Google Analytics 4 Measurement ID (G-XXXXXXXXXX)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Amazon Affiliate / other affiliate program
NEXT_PUBLIC_AMAZON_AFFILIATE_TAG=yourtag-20
```

### n8n / Automation

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
DEEPL_API_KEY=YOUR_DEEPL_KEY
FIRECRAWL_API_KEY=YOUR_FIRECRAWL_KEY
YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_KEY
NEXT_PUBLIC_SITE_URL=https://your-vercel-site.com
REVALIDATE_SECRET=YOUR_VERCEL_REVALIDATE_SECRET
```

## Adding Sources

Add rows to the `sources` table:

```sql
INSERT INTO sources (name, source_type, url, language, category_id)
VALUES (
  'My RSS Source',
  'rss',
  'https://example.com/feed.xml',
  'en',
  (SELECT id FROM categories WHERE slug = 'technology')
);
```

For YouTube, set `source_type = 'youtube'` and `url` to the channel ID.

## Customization & Next Steps

- [x] Google AdSense components (`AdSenseBanner`, `AdSenseInArticle`) in article page.
- [x] Affiliate link components (`AffiliateLink`, `AffiliateCallout`) in article page.
- [x] Google Analytics 4 integration (`GoogleAnalytics` component).
- [x] Dynamic OG image generator (`/api/og`) as fallback when no featured image exists.
- [x] View/click tracking to `article_stats` table via `/api/track-view` and `/api/track-click`.
- [x] Robust n8n workflows v2 with 4-language translation, error handling, batching.
- [ ] Implement `pgvector` semantic search.
- [ ] Replace AdSense placeholder slots with real Ad Unit IDs.
- [ ] Add real affiliate ASINs / offers to `AffiliateCallout`.
- [ ] Migrate Supabase project to a region closer to your audience if needed.

## Notes

- The n8n workflows (v2) include error handling, 4-language translation (he/en/es/ar), batching, and logging.
- Keep `service_role` key secret and never expose it in frontend code.
- View/click tracking writes to `article_stats` via Postgres functions (`increment_article_views`, `increment_article_clicks`).
