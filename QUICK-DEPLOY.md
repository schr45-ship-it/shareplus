# מדריך פריסה מהירה — קישור חי ב-Vercel

מטרה: לקבל קישור חי לאתר תוך כמה דקות.

> **חשוב:** אי אפשר להריץ את זה אוטומטית לגמרי כי צריך login ל-Vercel/GitHub. אבל אפשר להגיע לקישור חי ב-3 דקות עם הסקריפטים המוכנים.

---

## אפשרות א׳: פריסה ישירה דרך Vercel CLI (הכי מהירה, בלי Git)

### דרישות מוקדמות
- Node.js מותקן (מגיע עם `npx`)
- חשבון Vercel
- קובץ `.env.local` בתיקיית `frontend` עם כל הערכים האמיתיים

### שלבים (מהיר — קובץ BAT מוכן)

1. ודא שקובץ `frontend/.env.local` מולא בערכים אמיתיים.
2. לחץ פעמיים על: `scripts\deploy-everything.bat`
3. אם עדיין לא התחברת ל-Vercel, ייפתח חלון login — אשר אותו.
4. בסיום, תקבל URL חי.

### שלבים (PowerShell ידני)

1. פתח PowerShell בתיקיית הפרויקט:
   ```powershell
   cd C:\Users\schr4\פיתוחים\ai-shareplus
   ```

2. התחבר ל-Vercel:
   ```powershell
   npx vercel login
   ```

3. הרץ את סקריפט הפריסה:
   ```powershell
   .\scripts\deploy-live.ps1
   ```

4. בסיום, תקבל URL חי. שמור אותו.

---

## אפשרות ב׳: פריסה דרך GitHub + Vercel (Auto Deploy)

### דרישות מוקדמות
- חשבון GitHub
- מאגר (repository) ריק ב-GitHub
- חשבון Vercel

### שלב 1: Push הקוד ל-GitHub

1. צור מאגר חדש ב-GitHub: `https://github.com/YOUR_USERNAME/ai-shareplus`
2. העתק את ה-URL (למשל `https://github.com/YOUR_USERNAME/ai-shareplus.git`)
3. פתח PowerShell בתיקיית הפרויקט
4. הרץ את הסקריפט:
   ```powershell
   .\scripts\push-to-github.ps1
   ```
   כשמופיע prompt, הדבק את ה-URL של המאגר.

### שלב 2: חבר את GitHub ל-Vercel

1. כנס ל-[vercel.com/new](https://vercel.com/new)
2. בחר את המאגר `ai-shareplus`
3. ודא שה-root directory היא `frontend`
4. לחץ **Deploy**

Vercel יפרוס אוטומטית את הפרויקט ויתן לך קישור חי.

---

## אפשרות ג׳: פריסה ידנית דרך Vercel Dashboard

1. כנס ל-[vercel.com/new](https://vercel.com/new)
2. בחר **Import Git Repository** (אם הקוד ב-GitHub) או **Continue with Template**
3. העלה את תיקיית `frontend` כ-zip (לא מומלץ לעדכונים עתידיים)
4. הגדר environment variables מ-`frontend/env.example`
5. לחץ **Deploy**

---

## אחרי שיש קישור חי

### בדיקות מהירות

פתח בדפדפן:
- `https://your-site.com/en`
- `https://your-site.com/he`
- `https://your-site.com/sitemap.xml`
- `https://your-site.com/api/og?title=Test&category=Technology`

### אם עדיין אין מאמרים

זה תקין בשלב זה. המאמרים יתווספו אחרי שתפעיל את n8n על VPS.

---

## מה עם n8n על VPS?

n8n לא נחוץ לקישור החי עצמו, אבל הוא נחוץ כדי שהאתר יתמלא בתוכן אוטומטית.

לאחר שיש קישור חי:
1. הקם n8n על VPS לפי `n8n/VPS-SETUP.md`
2. ייבא workflows לפי `n8n/WORKFLOWS-IMPORT.md`
3. ודא שה-`NEXT_PUBLIC_SITE_URL` ב-n8n הוא ה-URL החי שלך

---

## בעיות נפוצות

### "npx vercel login" נכשל
- ודא שיש חיבור אינטרנט
- נסה דפדפן אחר
- השתמש ב-`npx vercel login --github` או `--gitlab`

### "env.local not found"
- צור את הקובץ: `cp frontend/env.example frontend/.env.local`
- מלא את כל הערכים האמיתיים

### קישור נותן 404
- ודא שה-root directory ב-Vercel היא `frontend`
- בדוק שה-build log ב-Vercel Dashboard לא מכיל שגיאות

### env vars חסרים ב-Vercel
- גש ל-Vercel Dashboard → Project → Settings → Environment Variables
- הוסף את כל המשתנים מ-`frontend/env.example`
