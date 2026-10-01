# מסמך אפיון טכני משופץ: AI News & Video Summarizer
## ai-shareplus — Fully Automated Multi-Language Content Engine

> **גרסה:** 2.0  
> **תאריך:** 2026-10-01  
> **מבוסס על:** אפיון מקורי + סקירה ושיפורים מבוצעת  

---

## 1. סקירת הפרויקט ומטרות

**מוצר:** פלטפורמת תוכן אוטומטית שמסננת, מסכמת ומתרגמת חדשות + סרטוני YouTube, ומפרסמת אותן באתר מהיר ומותאם ל-SEO במספר שפות.

**מטרות עסקיות:**
- יצירת תנועה אורגנית ממנועי חיפוש (SEO).
- השקעה מינימלית בתוכן (אוטומציה מלאה).
- מונטיזציה: AdSense / פרסום / affiliate / premium (בשלב מאוחר).

**KPIs ראשוניים:**
- 500–1,000 סיכומים חודשיים בשלב ההזנקה.
- זמן טעינת עמוד < 1.5 שניות (LCP).
- אחוז תוכן כפול < 2%.

---

## 2. סטאק טכנולוגי סופי

| שכבה | טכנולוגיה | סיבה |
|---|---|---|
| Frontend | **Next.js 15 App Router** | ISR, Server Components, SEO, i18n |
| Styling | Tailwind CSS + Shadcn/ui | מהירות פיתוח, עיצוב נקי |
| i18n | `next-intl` | ניהול שפות + routing |
| Backend / DB | **Supabase** (PostgreSQL) | DB, Auth, Storage, Full-Text Search |
| Automation | **n8n self-hosted** על VPS | זול, גמיש, מלא בקרה |
| AI Summarization | **Google Gemini 1.5 Flash** | יחס onput/output טוב |
| Translation | **DeepL API** (עיקרי) + Gemini (fallback) | איכות טובה יותר מ-Gemini לעברית/ערבית |
| Transcription | OpenAI Whisper (אם נדרש) | כשאין כתוביות YouTube |
| Extraction | Jina Reader → Firecrawl → Puppeteer fallback | חילוץ מאמרים |
| Hosting | Vercel | ISR + CDN גלובלי |
| Analytics | Google Analytics 4 + Search Console | מדידת תנועה |

> **הערה על Supabase Region:** הפרויקט הקיים מוגדר ב-`ap-southeast-2` (Sydney). אם הקהל היעד הוא ישראל/אירופה, מומלץ לפתוח פרויקט חדש ב-`eu-west-1` (אירלנד) או `eu-central-1` (פרנקפורט) כדי להקטין latency. אם נשארים ב-Sydney, יש להשתמש ב-Edge Functions וב-Vercel Edge Cache כדי לפצות.

---

## 3. ארכיטקטורת המערכת

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  RSS Feeds      │     │  YouTube Channels   │     │  Other APIs     │
│  (News sites)   │     │  (via Data API v3)  │     │  (optional)     │
└────────┬────────┘     └──────────┬──────────┘     └────────┬────────┘
         │                         │                        │
         └─────────────────────────┼────────────────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │   n8n Workflow Engine       │
                    │   (self-hosted on VPS)      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌──────────┐    ┌──────────┐   ┌──────────┐
            │ Fetch    │    │ Extract  │   │ Whisper  │
            │ RSS/JSON │    │ Article  │   │ (if no   │
            │          │    │ Text     │   │ captions)│
            └────┬─────┘    └────┬─────┘   └────┬─────┘
                 │               │              │
                 ▼               ▼              ▼
            ┌─────────────────────────────────────────┐
            │  Deduplication + Normalization            │
            │  (URL normalize + title hash)             │
            └─────────────────┬───────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │  AI Summarization (Gemini Flash)        │
            │  → structured JSON output               │
            └─────────────────┬───────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │  Translation (DeepL → Gemini fallback)  │
            └─────────────────┬───────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │  Supabase REST API (service_role)       │
            │  Insert articles + translations         │
            └─────────────────┬───────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │  Next.js Frontend (Vercel)              │
            │  ISR + i18n + Full-Text Search          │
            └─────────────────────────────────────────┘
```

---

## 4. סכימת בסיס הנתונים (Supabase PostgreSQL)

### 4.1 טבלה: `sources`
מקורות תוכן שמסקרים.

```sql
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'youtube')),
  url TEXT NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  category_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 טבלה: `categories`

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_json JSONB NOT NULL,        -- {"he": "טכנולוגיה", "en": "Technology"}
  description_json JSONB,          -- meta description per language
  color TEXT,                      -- optional UI color
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 טבלה: `articles`
ישות התוכן המרכזית.

```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id),
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('news', 'video')),
  original_language VARCHAR(5) NOT NULL,
  category_id UUID REFERENCES categories(id),
  
  -- דeduplication
  canonical_url TEXT,
  content_hash TEXT UNIQUE,
  
  -- metadata
  featured_image_url TEXT,
  video_duration_seconds INT,
  author TEXT,
  published_date TIMESTAMPTZ,
  
  -- workflow status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'extracting', 'summarizing', 'translating', 'review', 'published', 'rejected', 'archived')),
  
  processing_started_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_source_url ON articles(source_url);
CREATE INDEX idx_articles_content_hash ON articles(content_hash);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
```

### 4.4 טבלה: `article_translations`

```sql
CREATE TABLE article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL,
  
  title TEXT NOT NULL,
  seo_slug TEXT NOT NULL,
  seo_meta_title TEXT,
  seo_meta_description TEXT,
  
  summary JSONB NOT NULL DEFAULT '{}',
  -- מבנה JSONB מומלץ:
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
CREATE INDEX idx_article_translations_title ON article_translations USING gin(to_tsvector('simple', title));
CREATE INDEX idx_article_translations_summary ON article_translations USING gin(to_tsvector('simple', (summary->>'body')));
```

### 4.5 טבלה: `processing_logs`
לוג חובה לדיבאג ולמעקב.

```sql
CREATE TABLE processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  source_id UUID REFERENCES sources(id),
  step TEXT NOT NULL CHECK (step IN ('fetch', 'extract', 'dedupe', 'summarize', 'translate', 'publish', 'error')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_processing_logs_article ON processing_logs(article_id);
CREATE INDEX idx_processing_logs_created ON processing_logs(created_at DESC);
```

### 4.6 טבלה: `article_stats`
למעקב ביצועים (ניתן להוסיף בשלב מאוחר).

```sql
CREATE TABLE article_stats (
  article_id UUID PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  clicks_to_source INT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Row Level Security (RLS)

### 5.1 הכללים הבסיסיים

```sql
-- פעיל RLS על כל הטבלאות
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Frontend (anon key): רואה רק מאמרים שפורסמו
CREATE POLICY "anon_read_published_articles" ON articles
  FOR SELECT TO anon USING (status = 'published');

CREATE POLICY "anon_read_published_translations" ON article_translations
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM articles WHERE articles.id = article_translations.article_id AND articles.status = 'published'
    )
  );

CREATE POLICY "anon_read_categories" ON categories
  FOR SELECT TO anon USING (true);

-- service_role: הרשאות מלאות (נעשה שימוש רק מ-n8n)
-- אין צורך ב-policy ל-service_role כי הוא bypass RLS
```

### 5.2 אבטחת service_role
- לא לשמור את `service_role` key בקוד ה-frontend או ב-Vercel.
- לשמור אותו רק ב-n8n credentials / secrets manager.
- להגדיר IP allowlist ב-Supabase אם VPS n8n קבוע.
- לבצע rotate מפתחות אחת לכמה חודשים.

---

## 6. זרימת העבודה האוטומטית (n8n)

### 6.1 Workflow 1: RSS Ingestion
1. **Cron Trigger** — כל 30–60 דקות.
2. **Fetch RSS** — קריאה לכל `sources` מסוג `rss` הפעילים.
3. **Parse Items** — חילוץ title, link, pubDate.
4. **Normalize URL** — הסרת utm_* ופרמטרים מיותרים.
5. **Deduplication** — בדיקה מול `content_hash` או `canonical_url`.
6. **Insert to articles** — `status = 'pending'`.
7. **Processing Log** — רישום `fetch` / `success`.

### 6.2 Workflow 2: Content Processing
1. **Trigger on new `pending` article** — Postgres trigger / webhook.
2. **Set status = 'extracting'**.
3. **Extract text**:
   - ניסיון ראשון: Jina Reader (free/cheap).
   - נכשל → Firecrawl.
   - נכשל → Puppeteer / Playwright.
4. **Set status = 'summarizing'**.
5. **AI Summarization** — Gemini Flash עם prompt מובנה:
   - כותרת מסכמת (max 70 chars).
   - executive_summary (2–3 פסקאות).
   - key_takeaways (3–5 bullets).
   - tags (3–7).
   - קטגוריה מומלצת.
6. **Set status = 'translating'**.
7. **Translation** — לכל שפת יעד:
   - DeepL API (ראשי).
   - Gemini Flash (fallback).
8. **Set status = 'published'** (או `review` אם רוצים בקרה אנושית).
9. **Insert article_translations**.
10. **Revalidate ISR** — קריאה ל-Vercel revalidation webhook.

### 6.3 Workflow 3: YouTube Ingestion
1. **Cron Trigger** — כל שעה.
2. **YouTube Data API v3** — `search` בערוצים מוגדרים.
3. **Deduplication** — לפי videoId.
4. **Extract captions**:
   - ניסיון ראשון: כתוביות YouTube המובנות (SRT/VTT).
   - אם אין → Whisper (download audio + transcribe).
5. **Proceed to AI Summarization** — כמו ב-Workflow 2.

---

## 7. פורמט JSON של AI Output

### 7.1 Summarization Prompt Output

```json
{
  "title": "טכנולוגיה חדשה משפרת ניהול זמן",
  "category_slug": "technology",
  "executive_summary": "...",
  "key_takeaways": [
    "נקודה ראשונה",
    "נקודה שנייה",
    "נקודה שלישית"
  ],
  "tags": ["AI", "productivity", "time management"],
  "original_language": "en"
}
```

### 7.2 Translation Prompt Output

```json
{
  "title": "טכנולוגיה חדשה משפרת ניהול זמן",
  "seo_meta_description": "סקירה על טכנולוגיה חדשה לניהול זמן",
  "executive_summary": "...",
  "key_takeaways": ["...", "..."],
  "tags": ["בינה מלאכותית", "פרודוקטיביות", "ניהול זמן"]
}
```

---

## 8. Frontend — Next.js App Router

### 8.1 מבנה URL
```
/[locale]/                    → homepage
/[locale]/[category]          → קטגוריה
/[locale]/[category]/[slug]   → מאמר
/[locale]/search              → חיפוש
/[locale]/about               → עמודים סטטיים
/sitemap.xml                  → sitemap דינמי
/robots.txt                   → robots
```

### 8.2 i18n Configuration
- שפות ראשוניות: `he`, `en`, `es`, `ar`.
- ברירת מחדל: `en`.
- שימוש ב-`next-intl` לניתוב ותרגום UI.

### 8.3 SEO Checklist
- Meta title/description לכל מאמר בשפת היעד.
- Canonical URL + `hreflang` לכל גרסאות השפה.
- OpenGraph + Twitter Cards.
- JSON-LD `Article` structured data.
- Dynamic XML sitemap (כולל `lastmod`).
- `robots.txt` + meta robots.

### 8.4 Search
- Full-Text Search על `article_translations` דרך Supabase.
- Query לדוגמה:
  ```sql
  SELECT * FROM article_translations
  WHERE language = 'he'
    AND to_tsvector('simple', title || ' ' || (summary->>'body')) @@ plainto_tsquery('simple', 'בינה מלאכותית')
  ORDER BY created_at DESC
  LIMIT 20;
  ```

### 8.5 ISR Configuration
- `revalidate: 3600` (1 שעה) בעמודים כלליים.
- `revalidate: false` או `on-demand` לעמוד מאמר (revalidate דרך webhook מ-n8n).

---

## 9. תוכנית עלויות מוערכת (ריאליסטית)

| שירות | תקציב חודשי משוער | הערות |
|---|---|---|
| Supabase Pro | $25 | DB 8GB, connection pooler, daily backups |
| Vercel Pro | $20 | ISR, analytics, more bandwidth |
| n8n VPS (2GB RAM) | $6–$10 | Hetzner / DigitalOcean |
| Gemini 1.5 Flash | $5–$15 | תלוי בכמות ואורך תוכן |
| DeepL API | $0–$20 | Free tier 500K chars/ch, אחרי זה Pro |
| YouTube Data API | $0 | Quota חינמי בדרך כלל מספיק |
| Firecrawl/Jina | $0–$20 | תלוי בחילוץ |
| **סה"כ משוער** | **$60–$110/חודש** | בהנחת 1,000–3,000 מאמרים/חודש |

> **הערה:** הערכת האפיון המקורי ($10–$30 ל-50,000 כתבות) היא אופטימית מדי. בעולם האמיתי, 50,000 כתבות יעלו יותר בסיכום + תרגום. מומלץ לבצע pilot עם 100 כתבות ולמדוד עלות אמיתית.

---

## 10. שלבי יישום (MVP Roadmap)

### שלב 1: Foundation (שבוע 1)
- [ ] הקמת Supabase project (region מתאים) + טבלאות.
- [ ] הגדרת RLS ו-service_role security.
- [ ] הקמת Next.js 15 + next-intl + Tailwind.
- [ ] עמודי בסיס: homepage, category, article, search.

### שלב 2: Ingestion (שבוע 2)
- [ ] התקנת n8n על VPS.
- [ ] Workflow RSS לחילוץ ושמירת מאמרים ב-status `pending`.
- [ ] Workflow YouTube לגילוי סרטונים חדשים.
- [ ] Deduplication logic.

### שלב 3: AI Processing (שבוע 3)
- [ ] חיבור Gemini Flash לסיכום.
- [ ] חיבור DeepL לתרגום.
- [ ] JSON parsing ושמירה ב-`article_translations`.
- [ ] לוגים מפורטים ב-`processing_logs`.

### שלב 4: Frontend Polish & SEO (שבוע 4)
- [ ] ISR + revalidation webhook.
- [ ] SEO tags, hreflang, JSON-LD, sitemap.
- [ ] Full-Text Search.
- [ ] OG images.

### שלב 5: Monetization & Scale (שלב מאוחר)
- [ ] Google AdSense.
- [ ] Affiliate links.
- [ ] Analytics events.
- [ ] pgvector לחיפוש סמנטי (אופציונלי).

---

## 11. סיכונים ומיגור

| סיכון | הסתברות | השפעה | מיגור |
|---|---|---|---|
| חסימת scraping מאתרי מקור | בינונית | גבוהה | Fallback extraction, שימוש ב-APIים רשמיים |
| עלות AI מחליקה | בינונית | גבוהה | Gemini Flash, batching, monitoring |
| תוכן כפול | גבוהה | בינונית | Hash + URL normalization |
| בעיות חוקיות / DMCA | נמוכה | גבוהה | Attribution ברור, summary-only, respect robots.txt |
| service_role leak | נמוכה | גבוהה | Secrets manager, IP allowlist, rotate keys |
| High DB latency (Sydney) | גבוהה | בינונית | Edge Functions, CDN cache, או מיגרציה לאירופה |

---

## 12. החלטות פתוחות לפני תחילת פיתוח

1. **Region Supabase:** האם להישאר ב-`ap-southeast-2` או להעביר ל-`eu-west-1`?
2. **שפות יעד ראשוניות:** האם מתחילים עם `he,en` או `he,en,es,ar`?
3. **בקרה אנושית:** `published` אוטומטי או `review` לפני פרסום?
4. **מודל הכנסות ראשוני:** AdSense / affiliate / שניהם?
5. **מקורות תוכן ראשוניים:** אילו 3–5 אתרי RSS וערוצי YouTube להתחיל איתם?

---

## 13. רשימת API Keys וSecrets הנדרשים

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (n8n only)
- `SUPABASE_ANON_KEY` (frontend only)
- `GEMINI_API_KEY`
- `DEEPL_API_KEY`
- `OPENAI_API_KEY` (ל-Whisper fallback)
- `YOUTUBE_DATA_API_KEY`
- `FIRECRAWL_API_KEY` (optional)
- `N8N_WEBHOOK_SECRET`
- `VERCEL_REVALIDATE_TOKEN`

---

*מסמך זה מהווה PRD משופץ לפרויקט ai-shareplus. מומלץ לאשר את ההחלטות הפתוחות (סעיף 12) לפני מעבר לפיתוח.*
