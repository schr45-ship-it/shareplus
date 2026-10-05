// Repoint articles whose storage image was uploaded as JSON-serialized Buffer
// to the /api/img/{id} repair route. Requires admin_set_article_image (migration 008).
// Usage: ADMIN_TOKEN=... node scripts/fix-json-images.mjs
import fs from "fs";
import path from "path";

const envFile = path.resolve(import.meta.dirname, "../frontend/.env.local");
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => l.split("=")),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TOKEN = process.env.ADMIN_TOKEN || "";
if (!TOKEN) throw new Error("ADMIN_TOKEN required");

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const articles = await (
  await fetch(`${BASE}/rest/v1/articles?select=id,featured_image_url&featured_image_url=like.*article-images*`, { headers: h })
).json();
console.log("articles with storage images:", articles.length);

let fixed = 0;
for (const a of articles) {
  try {
    const r = await fetch(a.featured_image_url);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 2 && buf[0] === 0x7b) {
      const res = await fetch(`${BASE}/rest/v1/rpc/admin_set_article_image`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ p_token: TOKEN, p_article: a.id, p_url: `/api/img/${a.id}.jpg` }),
      });
      if (!res.ok) console.log("RPC fail", a.id, res.status, await res.text());
      else fixed++;
    }
  } catch (e) {
    console.log("check fail", a.id, e.message);
  }
}
console.log("fixed:", fixed);
