# הגדרת n8n על VPS והתקנת Workflows

מדריך זה מסביר איך להקים שרת n8n על VPS, לחבר אותו ל-Supabase, ולייבא את ה-workflows של ai-shareplus.

למדריך מפורט לייבוא workflows, ראה גם: `WORKFLOWS-IMPORT.md`.

---

## דרישות

- VPS עם **2GB RAM** לפחות (Hetzner CX21 / DigitalOcean Droplet / Vultr)
- **Ubuntu 22.04/24.04** או **Debian 11/12**
- דומיין / sub-domain שמצביע ל-VPS (למשל `n8n.yourdomain.com`)

---

## אפשרות א׳: התקנה אוטומטית בסקריפט אחד

1. העתק את הקובץ `n8n/vps-install.sh` לשרת:

```bash
scp n8n/vps-install.sh root@YOUR_VPS_IP:/root/
ssh root@YOUR_VPS_IP
bash /root/vps-install.sh
```

2. הסקריפט יבקש את הדומיין (`n8n.yourdomain.com`) ויתקין:
   - Docker + docker-compose
   - Caddy
   - Firewall (UFW)
   - קבצי הגדרות (`docker-compose.yml`, `Caddyfile`, `.env`)

3. אחרי ההתקנה, ערוך את הקובץ:

```bash
nano ~/n8n/.env
```

והשלם את כל הסודות האמיתיים.

4. התחל את n8n:

```bash
cd ~/n8n
docker-compose up -d
```

5. פתח בדפדפן: `https://n8n.yourdomain.com` וצור חשבון owner.

---

## אפשרות ב׳: התקנה ידנית

### 1. התקנת Docker + docker-compose

```bash
sudo apt update && sudo apt install -y docker.io docker-compose curl
```

### 2. התקנת Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
sudo apt update && sudo apt install -y caddy
```

### 3. קבצי הגדרות

צור תיקייה:

```bash
mkdir -p ~/n8n && cd ~/n8n
```

העתק לתוכה את הקבצים:
- `n8n/docker-compose.yml`
- `n8n/Caddyfile`
- `n8n/.env.example` (שנה שם ל-`.env` ומלא ערכים)

### 4. Caddyfile

עדכן `/etc/caddy/Caddyfile`:

```
n8n.yourdomain.com {
    reverse_proxy 127.0.0.1:5678
}
```

טען מחדש:

```bash
sudo systemctl reload caddy
```

### 5. Firewall

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 6. הפעלת n8n

```bash
cd ~/n8n
docker-compose up -d
```

### 7. יצירת חשבון Owner

פתח בדפדפן: `https://n8n.yourdomain.com` ומלא email + password חזק.

---

## ניהול n8n

### עצירה והפעלה מחדש

```bash
cd ~/n8n
docker-compose down
docker-compose up -d
```

### צפייה בלוגים

```bash
cd ~/n8n
docker-compose logs -f n8n
```

### עדכון n8n

```bash
cd ~/n8n
docker-compose pull
docker-compose down
docker-compose up -d
```

---

## הגדרת Variables ב-n8n

1. פתח את n8n בדפדפן.
2. **Settings** → **Variables**.
3. הוסף כל משתנה מהקובץ `.env`:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
DEEPL_API_KEY
FIRECRAWL_API_KEY
YOUTUBE_DATA_API_KEY
NEXT_PUBLIC_SITE_URL
REVALIDATE_SECRET
```

---

## ייבוא Workflows

ראה את המדריך המלא: `n8n/WORKFLOWS-IMPORT.md`.

בקצרה:

1. צור credential מסוג **Supabase API** בשם **`supabase-service-role`** עם ה-`service_role` key.
2. ייבא את הקבצים מתוך `n8n/workflows/`:
   - `rss-ingestion.json`
   - `youtube-ingestion.json`
   - `ai-processing.json`
3. חבר את ה-credential לכל נוד Supabase.
4. שמור והפעל כל workflow (`Active: ON`).

---

## אבטחה

- **שמור את `SUPABASE_SERVICE_ROLE_KEY` בסוד** — אל תשתף אותו.
- הגדר **IP Allowlist** ב-Supabase → Project Settings → API → רק ל-IP הציבורי של ה-VPS.
- סובב מפתחות API כל כמה חודשים.
- ודא שפורט 5678 פתוח רק ל-localhost (מוגדר כבר ב-`docker-compose.yml`).
