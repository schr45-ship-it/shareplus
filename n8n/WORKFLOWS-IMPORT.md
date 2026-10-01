# ייבוא והפעלת Workflows ב-n8n

מדריך זה מניח שכבר התקנת את n8n על VPS ושהוא נגיש בדומיין (למשל `https://n8n.yourdomain.com`).

---

## שלב 1: כניסה ראשונה ויצירת חשבון Owner

1. פתח בדפדפן: `https://n8n.yourdomain.com`
2. תראה מסך "Setup Owner". מלא:
   - **Email**
   - **Password** חזק
3. היכנס ל-dashboard.

> **טיפ:** אם אתה רואה מסך login ללא אפשרות יצירת חשבון, ייתכן שהקימו חשבון בעבר. בדוק את `~/.n8n` או אפס את התיקייה אם זו התקנה חדשה.

---

## שלב 2: הגדרת Environment Variables ב-n8n

1. ב-n8n: לחץ על **Settings** (גלגל שיניים) → **Variables**
2. הוסף כל אחד מהמשתנים הבאים:

| Key | Value | מקור |
|---|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT_ID.supabase.co` | Supabase → API Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `YOUR_SERVICE_ROLE_KEY` | Supabase → API Settings |
| `GEMINI_API_KEY` | `YOUR_GEMINI_KEY` | Google AI Studio |
| `DEEPL_API_KEY` | `YOUR_DEEPL_KEY` | DeepL Console |
| `FIRECRAWL_API_KEY` | `YOUR_FIRECRAWL_API_KEY` | Firecrawl Dashboard |
| `YOUTUBE_DATA_API_KEY` | `YOUR_YOUTUBE_KEY` | Google Cloud Console |
| `NEXT_PUBLIC_SITE_URL` | `https://your-vercel-site.com` | Vercel |
| `REVALIDATE_SECRET` | מחרוזת אקראית | אותה ערך כמו ב-Vercel |

3. שמור.

---

## שלב 3: יצירת Credential ל-Supabase

1. ב-n8n: **Settings** → **Credentials** → **Add Credential**
2. חפש: **Supabase API**
3. מלא:
   - **Host**: `YOUR_PROJECT_ID.supabase.co` (ללא `https://`)
   - **Service Role Secret**: `YOUR_SERVICE_ROLE_KEY`
4. לחץ **Save**
5. ודא שה-credential נשמר בשם **`supabase-service-role`** (זה השם שכל ה-workflows מחפשים).

> **שים לב:** אל תשתמש ב-`anon` key כאן. ה-workflows צריכים הרשאות כתיבה.

---

## שלב 4: ייבוא Workflows

1. ב-n8n: **Workflows** → **Add Workflow** (או כפתור **Import from File**)
2. ייבא את הקבצים הבאים מתוך `n8n/workflows/`:
   - `rss-ingestion.json`
   - `youtube-ingestion.json`
   - `ai-processing.json`
3. לכל workflow שייבאת:
   - בדוק שה-credential `supabase-service-role` מחובר לכל נוד מסוג Supabase
   - שמור (`Ctrl+S` / `Cmd+S`)
   - הפעל (`Active: ON`)

---

## שלב 5: חיבור Credential לכל נוד Supabase

לאחר הייבוא, לפעמים צריך לחבר מחדש את ה-credential:

1. פתח כל workflow.
2. לחץ על כל נוד מסוג **Supabase** (בצבע כחול).
3. בצד ימין, בחר ב-**Credential** → `supabase-service-role`.
4. חזור על הפעולה לכל נוד Supabase ב-workflow.
5. שמור והפעל.

---

## שלב 6: בדיקות ראשוניות

### בדיקת RSS Ingestion

1. ודא שבטבלת `sources` ב-Supabase יש source פעיל מסוג `rss`.
2. ב-n8n, פתח את workflow `ai-shareplus: RSS Ingestion (v2)`.
3. לחץ **Execute Workflow**.
4. המתן 10–30 שניות.
5. בדוק ב-Supabase:
   ```sql
   SELECT id, source_url, status, created_at
   FROM articles
   ORDER BY created_at DESC
   LIMIT 10;
   ```
6. בדוק גם את `processing_logs` לשגיאות:
   ```sql
   SELECT * FROM processing_logs
   WHERE status = 'error'
   ORDER BY created_at DESC;
   ```

### בדיקת AI Processing

1. ודא שיש מאמרים בסטטוס `pending`:
   ```sql
   SELECT id, source_url FROM articles WHERE status = 'pending' LIMIT 5;
   ```
2. ב-n8n, פתח את workflow `ai-shareplus: AI Summarize & Translate (v2)`.
3. לחץ **Execute Workflow**.
4. המתן (יכול לקחת דקה או שתיים לכמה מאמרים).
5. בדוק ב-Supabase:
   ```sql
   SELECT a.id, at.language, at.title, a.status
   FROM articles a
   JOIN article_translations at ON at.article_id = a.id
   ORDER BY a.created_at DESC
   LIMIT 10;
   ```
6. אמורות להיות 4 שורות תרגום (`en`, `he`, `es`, `ar`) לכל מאמר.

### בדיקת Frontend

1. פתח את האתר ב-Vercel.
2. נווט למאמר.
3. בדוק ש-OG image מופיע ב-`meta tags`.
4. בדוק analytics:
   ```sql
   SELECT * FROM article_stats ORDER BY views DESC LIMIT 5;
   ```

---

## פתרון תקלות

### "Invalid API key" או שגיאת Supabase
- ודא שה-`SUPABASE_SERVICE_ROLE_KEY` נכון.
- ודא שה-IP של ה-VPS לא חסום ב-Supabase → Settings → API → IP Allowlist.
- ודא שה-credential `supabase-service-role` מחובר לכל נוד Supabase.

### Workflow רץ אבל לא נוספים מאמרים
- בדוק `processing_logs` לשגיאות.
- ייתכן שה-RSS feed חסום — נסה לעדכן את ה-URL או להשתמש ב-Firecrawl.

### Gemini מחזיר JSON לא תקין
- בדוק את `processing_logs` — יש שם שגיאות parse.
- ניתן להוסיף fallback prompt או לשנות את ה-`temperature` ל-0.1–0.2.

### Revalidation נכשל
- ודא ש-`NEXT_PUBLIC_SITE_URL` ו-`REVALIDATE_SECRET` נכונים ב-n8n וב-Vercel.
- בדוק את לוגי ה-build ב-Vercel.

---

## כוונון תדירות הריצה

ברירת המחדל:
- **RSS Ingestion**: כל 30 דקות
- **YouTube Ingestion**: כל שעה
- **AI Processing**: כל 5 דקות

כדי לשנות:
1. פתח workflow.
2. לחץ על נוד ה-trigger (למשל "Every 30 mins").
3. שנה את ה-interval.
4. שמור והפעל מחדש.
