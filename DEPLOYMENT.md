# מדריך פריסה מלא — ai-shareplus

> **חשוב:** אין אפשרות לפרוס אוטומטית ללא אימות Vercel / גישה ל-VPS. מדריך זה מפרט צעד אחד-אחד איך לפרוס כל רכיב.

---

## 1. פריסת Frontend ל-Vercel

### א. התקנת Vercel CLI והתחברות

פתח terminal בתיקיית `frontend` והרץ:

```bash
npx vercel login
# או
npx vercel
```

- אם נדרש, אשר דרך הדפדפן.
- לאחר login, הרץ:

```bash
npx vercel --prod
```

### ב. הגדרת Environment Variables ב-Vercel

אפשר להגדיר דרך Dashboard או דרך CLI:

```bash
npx vercel env add NEXT_PUBLIC_SITE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add REVALIDATE_SECRET
npx vercel env add NEXT_PUBLIC_ADSENSE_CLIENT_ID
npx vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID
npx vercel env add NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
```

לכל משתנה, בחר:
- **Environment:** Production (וגם Preview אם רוצים)
- **Value:** הערך המתאים

**טבלת ערכים:**

| משתנה | מקור הערך |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | הדומיין שקיבלת ב-Vercel, למשל `https://ai-shareplus.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon public` key |
| `REVALIDATE_SECRET` | מחרוזת אקראית חזקה (32+ תווים) — ליצור ולשמור גם ב-n8n |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Google AdSense → `ca-pub-XXXXXXXXXXXXXXXX` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics → `G-XXXXXXXXXX` |
| `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` | Amazon Associates → `yourtag-20` |

### ג. בדיקת פריסה

אחרי deploy, בדוק:

```
https://YOUR_VERCEL_URL/he
https://YOUR_VERCEL_URL/en
https://YOUR_VERCEL_URL/en/technology
```

אם עדיין אין מאמרים, תראה עמוד ריק — זה תקין בשלב זה.

---

## 2. הגדרת n8n על VPS

ראה גם: `n8n/VPS-SETUP.md`.

### א. דרישות VPS מינימליות

- 2 vCPU, 2GB RAM, 25GB SSD
- Hetzner CX21 / DigitalOcean $12 droplet / Vultr מקביל

### ב. התקנת Docker ו-Caddy

```bash
ssh root@YOUR_VPS_IP
apt update && apt install -y docker.io docker-compose curl

# Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

### ג. הרמת n8n עם docker-compose

```bash
mkdir -p ~/n8n && cd ~/n8n
cat > docker-compose.yml <<'EOF'
version: "3"
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "127.0.0.1:5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=CHANGE_ME_STRONG_PASSWORD
      - N8N_HOST=n8n.yourdomain.com
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.yourdomain.com/
      - GENERIC_TIMEZONE=Asia/Jerusalem
      - N8N_SECURE_COOKIE=false
    volumes:
      - ~/.n8n:/home/node/.n8n
EOF

docker-compose up -d
```

### ד. חיבור דומיין עם HTTPS

```bash
cat > /etc/caddy/Caddyfile <<'EOF'
n8n.yourdomain.com {
    reverse_proxy 127.0.0.1:5678
}
EOF
systemctl reload caddy
```

### ה. הגדרת Environment Variables ב-n8n

פתח את n8n בדפדפן: `https://n8n.yourdomain.com`

היכנס עם ה-user/password שב-`docker-compose.yml`.

Settings → Variables → הוסף:

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
DEEPL_API_KEY=YOUR_DEEPL_KEY
FIRECRAWL_API_KEY=YOUR_FIRECRAWL_API_KEY
YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_KEY
NEXT_PUBLIC_SITE_URL=https://your-vercel-site.com
REVALIDATE_SECRET=המחרוזת_שהגדרת_ב_Vercel
```

### ו. ייבוא והפעלת Workflows

1. ב-n8n: Settings → Credentials → Add Credential → **Supabase API**
   - Host: `YOUR_PROJECT_ID.supabase.co`
   - Service Role Secret: `YOUR_SERVICE_ROLE_KEY`
   - שמור בשם `supabase-service-role`

2. Workflows → Import from File → ייבא את שלושת הקבצים מתוך `n8n/workflows/`

3. לכל workflow:
   - ודא שכל נוד Supabase מחובר ל-credential.
   - שמור.
   - הפעל (`Active: ON`).

---

## 3. בדיקות אחרי פריסה

### בדיקת Frontend

- [ ] דף הבית עובר בכל שפה (`/he`, `/en`, `/es`, `/ar`)
- [ ] עמוד קטגוריה עובד (`/en/technology`)
- [ ] חיפוש עובד (`/en/search?q=ai`)
- [ ] `/sitemap.xml` נטען
- [ ] `/api/og?title=Test&category=Technology` מחזיר תמונה

### בדיקת n8n

1. ודא שיש לפחות source פעיל אחד בטבלת `sources` ב-Supabase.
2. הרץ ידנית את workflow `ai-shareplus: RSS Ingestion`.
3. בדוק בטבלה `articles` אם נוספו רשומות בסטטוס `pending`.
4. הרץ ידנית את workflow `ai-shareplus: AI Summarize & Translate`.
5. בדוק בטבלה `article_translations` אם נוספו סיכומים.
6. בדוק ב-frontend אם המאמרים מופיעים.

---

## 4. פתרון תקלות נפוצות

### AdSense לא מופיע
- ודא `NEXT_PUBLIC_ADSENSE_CLIENT_ID` מוגדר.
- AdSense דורש review של האתר לפני הצגת מודעות אמיתיות.
- במצב localhost / preview תראה placeholders — זה תקין.

### תמונות OG לא נטענות
- ודא `NEXT_PUBLIC_SITE_URL` מכיל את הדומיין האמיתי.
- בדוק ישירות: `https://your-site.com/api/og?title=Test&category=Tech`

### n8n לא מקבל תוכן
- בדוק טבלת `processing_logs` ב-Supabase.
- ודא שה-`service_role` key נכון.
- ודא שה-IP של ה-VPS לא חסום ב-Supabase (Project Settings → API → IP allowlist).

### build נכשל ב-Vercel
- ודא שכל משתני הסביבה מוגדרים.
- בדוק ש-`NEXT_PUBLIC_SUPABASE_ANON_KEY` הוא ה-key הציבורי (לא service_role).

---

## 5. אבטחה חובה לפני production

- [ ] שנה את `N8N_BASIC_AUTH_PASSWORD` לסיסמה חזקה.
- [ ] הגבל IP ל-Supabase allowlist (IP ציבורי של ה-VPS).
- [ ] סובב מפתחות API כל כמה חודשים.
- [ ] ודא ש-`service_role` key לא מופיע בשום מקום בקוד או ב-Vercel.
- [ ] הפעל firewall: `ufw allow 22,80,443/tcp && ufw enable`.

---

## 6. סקריפטים מוכנים

### העתקת env vars מקובץ ל-Vercel (after login)

לאחר `npx vercel login`, ניתן להריץ:

```bash
# ב-PowerShell
.\scripts\deploy-vercel.ps1
```

או ב-bash:

```bash
# ב-bash
bash ./scripts/deploy-vercel.sh
```

> **שים לב:** הסקריפטים יעבדו רק אם קיים קובץ `.env.production` או `.env.local` עם כל הערכים.
