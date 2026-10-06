"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { articleImageUrl, categoryLabel } from "@/lib/site";

type Source = {
  id: string;
  name: string;
  source_type: string;
  url: string;
  is_active: boolean;
  last_checked_at: string | null;
  last_error: string | null;
  article_count: number;
};

type Category = {
  id: string;
  slug: string;
  name_json: Record<string, string>;
  is_active: boolean;
  article_count: number;
  published_count: number;
  views: number;
};

type RecentArticle = {
  id: string;
  status: string;
  source_type: string;
  published_at: string | null;
  created_at: string;
  source_url: string;
  category_slug: string | null;
  title_he: string | null;
  title_en: string | null;
  slug_he: string | null;
  slug_en: string | null;
  views: number;
  clicks: number;
  featured_image_url: string | null;
  youtube_video_id: string | null;
  source_id: string | null;
  source_name: string | null;
  subcategory_slug: string | null;
  subcategory_name: Record<string, string> | null;
};

type ManualArticle = {
  id: string;
  status: string;
  original_language: string;
  created_at: string;
  published_at: string | null;
  featured_image_url: string | null;
  requested_topic: string;
  requested_long: boolean;
  processing_error: string | null;
  category_slug: string | null;
  title_he: string | null;
  title_en: string | null;
  slug_he: string | null;
  slug_en: string | null;
};

type Overview = {
  status_counts: Record<string, number>;
  totals: {
    articles: number;
    published: number;
    pending: number;
    views: number;
    clicks: number;
    videos: number;
    videos_published: number;
    news: number;
  };
  categories: Category[];
  sources: Source[];
  recent_articles: RecentArticle[];
};

const STATUS_LABELS: Record<string, string> = {
  published: "מפורסמות",
  pending: "ממתינות",
  failed: "נכשלו",
  extracting: "בחילוץ",
  summarizing: "בסיכום",
  translating: "בתרגום",
  rejected: "נדחו",
  archived: "בארכיון",
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Toggle({
  active,
  onChange,
  disabled,
}: {
  active: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition disabled:opacity-40 ${
        active ? "bg-green-500" : "bg-zinc-300"
      }`}
      aria-pressed={active}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          active ? "left-0.5" : "left-5.5"
        }`}
        style={{ left: active ? "0.125rem" : "1.375rem" }}
      />
    </button>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [artPage, setArtPage] = useState(1);
  const [showCategories, setShowCategories] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryCat, setGalleryCat] = useState<string>("all");
  const [reports, setReports] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [manualArticles, setManualArticles] = useState<ManualArticle[]>([]);
  const [showManualArticles, setShowManualArticles] = useState(true);
  const [newCat, setNewCat] = useState({ slug: "", en: "", he: "", es: "", ar: "" });
  const [articleTopic, setArticleTopic] = useState("");
  const [articleLanguage, setArticleLanguage] = useState("he");
  const [articleLong, setArticleLong] = useState(true);
  const [articleRequestStatus, setArticleRequestStatus] = useState<string | null>(null);
  const ART_PAGE_SIZE = 20;

  const matchesFilter = (a: RecentArticle) => {
    if (filter === "all") return true;
    if (filter === "pending") return ["pending", "failed", "extracting", "summarizing", "translating"].includes(a.status);
    if (filter === "rss") return a.source_type === "news";
    if (filter === "video") return a.source_type === "video";
    if (filter.startsWith("cat:")) return a.category_slug === filter.slice(4);
    if (filter.startsWith("src:")) return a.source_id === filter.slice(4);
    return a.status === filter;
  };

  const supabase = createClient();

  const load = useCallback(
    async (t: string) => {
      setLoading(true);
      setError(null);
      const { data, error } = await (supabase.rpc as any)("admin_overview", {
        p_token: t,
      });
      setLoading(false);
      if (error) {
        setError(error.message.includes("unauthorized") ? "סיסמה שגויה" : error.message);
        return;
      }
      setData(data as Overview);
      const { data: reps } = await (supabase.rpc as any)("admin_reports", { p_token: t });
      setReports((reps as any[]) ?? []);
      const { data: msgs } = await (supabase.rpc as any)("admin_contact_messages", { p_token: t });
      setMessages((msgs as any[]) ?? []);
      const { data: requested } = await (supabase.rpc as any)("admin_manual_articles", {
        p_token: t,
        p_limit: 100,
      });
      setManualArticles((requested as ManualArticle[]) ?? []);
    },
    [supabase],
  );

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (t) {
      setToken(t);
      setSavedToken(t);
      load(t);
    }
  }, [load]);

  async function call(fn: string, params: Record<string, unknown>, id: string) {
    if (!savedToken) return;
    setBusy(id);
    const { error } = await (supabase.rpc as any)(fn, {
      p_token: savedToken,
      ...params,
    });
    if (error) setError(error.message);
    else await load(savedToken);
    setBusy(null);
  }

  async function requestArticle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!savedToken || articleTopic.trim().length < 3) return;
    setBusy("article-request");
    setArticleRequestStatus(null);
    const { error } = await (supabase.rpc as any)("admin_create_article_request", {
      p_token: savedToken,
      p_topic: articleTopic.trim(),
      p_language: articleLanguage,
      p_long: articleLong,
    });
    if (error) {
      setArticleRequestStatus(`שגיאה: ${error.message}`);
    } else {
      setArticleTopic("");
      setArticleRequestStatus("הבקשה נוספה לתור. הבוט ייצור ויפרסם את הכתבה אוטומטית.");
      await load(savedToken);
    }
    setBusy(null);
  }

  if (!savedToken || !data) {
    return (
      <main dir="rtl" className="mx-auto max-w-md px-4 py-16">
        <h1 className="mb-6 text-2xl font-bold">ניהול האתר</h1>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            localStorage.setItem("admin_token", token);
            setSavedToken(token);
            await load(token);
          }}
        >
          <label className="text-sm text-zinc-600">
            סיסמת ניהול
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            dir="ltr"
          />
          <button
            type="submit"
            disabled={loading || !token}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "בודק..." : "כניסה"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  const t = data.totals;

  return (
    <main dir="rtl" className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ניהול האתר</h1>
        <button
          onClick={() => load(savedToken)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          רענון
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* KPI cards */}
      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {([
          ["סה״כ תוכן", t.articles, "all"],
          ["מפורסמות", t.published, "published"],
          ["בתור", t.pending, "pending"],
          ["כתבות RSS", t.news, "rss"],
          ["סרטונים", t.videos, "video"],
          ["תמונות", data.recent_articles.filter((a) => a.featured_image_url || a.youtube_video_id).length, "gallery"],
          ["צפיות", t.views, null],
          ["קליקים למקור", t.clicks, null],
          ["מקורות פעילים", data.sources.filter((s) => s.is_active).length, null],
        ] as const).map(([label, value, f]) => (
          <div
            key={label}
            onClick={
              f === "gallery"
                ? () => setShowGallery((v) => !v)
                : f
                  ? () => { setFilter(f); setArtPage(1); }
                  : undefined
            }
            className={`rounded-xl border bg-white p-4 shadow-sm transition ${
              f ? "cursor-pointer hover:border-blue-400" : ""
            } ${(f === "gallery" ? showGallery : filter === f) ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-200"}`}
          >
            <div className="text-2xl font-bold text-zinc-900">{value}</div>
            <div className="text-xs text-zinc-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-xl border-2 border-blue-200 bg-blue-50 p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-blue-950">יצירת כתבה לפי נושא</h2>
        <p className="mb-4 text-sm text-blue-800">
          כתוב נושא או הנחיה מפורטת. הבוט ייצור כתבה בארבע שפות, ישייך קטגוריה ויוסיף תמונה מתאימה.
        </p>
        <form onSubmit={requestArticle} className="space-y-3">
          <textarea
            value={articleTopic}
            onChange={(e) => setArticleTopic(e.target.value)}
            minLength={3}
            maxLength={500}
            rows={3}
            required
            placeholder="לדוגמה: מדריך מעשי לשימוש בטוח בבינה מלאכותית לעסקים קטנים"
            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              שפת הנושא
              <select
                value={articleLanguage}
                onChange={(e) => setArticleLanguage(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5"
              >
                <option value="he">עברית</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ar">العربية</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={articleLong}
                onChange={(e) => setArticleLong(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              כתבה ארוכה ומעמיקה
            </label>
            <button
              type="submit"
              disabled={busy === "article-request" || articleTopic.trim().length < 3}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === "article-request" ? "מוסיף לתור..." : "צור כתבה"}
            </button>
          </div>
          {articleRequestStatus && (
            <p className={`text-sm ${articleRequestStatus.startsWith("שגיאה") ? "text-red-700" : "text-green-700"}`}>
              {articleRequestStatus}
            </p>
          )}
        </form>
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowManualArticles((value) => !value)}
          className="flex w-full items-center justify-between p-5 text-right hover:bg-zinc-50"
          aria-expanded={showManualArticles}
        >
          <span className="font-semibold">כתבות שיצרתי עם הבוט ({manualArticles.length})</span>
          <span className="text-zinc-400">{showManualArticles ? "▲" : "▼"}</span>
        </button>
        {showManualArticles && (
          <div className="border-t border-zinc-200 p-4">
            {manualArticles.length === 0 ? (
              <p className="text-sm text-zinc-500">עדיין לא נוצרו כתבות לפי בקשה ידנית.</p>
            ) : (
              <div className="space-y-3">
                {manualArticles.map((article) => {
                  const title = article.title_he || article.title_en || article.requested_topic;
                  const slug = article.slug_he || article.slug_en;
                  const language = article.slug_he ? "he" : "en";
                  const href = article.status === "published" && article.category_slug && slug
                    ? `/${language}/${article.category_slug}/${slug}`
                    : null;
                  return (
                    <article
                      key={article.id}
                      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center"
                    >
                      {article.featured_image_url && (
                        <img
                          src={articleImageUrl(article.featured_image_url) ?? undefined}
                          alt=""
                          className="h-20 w-full rounded-md object-cover sm:h-16 sm:w-28"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={article.status} />
                          {article.requested_long && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              ארוכה
                            </span>
                          )}
                          <time className="text-xs text-zinc-400" dateTime={article.created_at}>
                            {new Date(article.created_at).toLocaleString("he-IL")}
                          </time>
                        </div>
                        <h3 className="truncate text-sm font-semibold text-zinc-900">{title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          נושא שביקשת: {article.requested_topic}
                        </p>
                        {article.processing_error && (
                          <p className="mt-1 text-xs text-red-600">{article.processing_error}</p>
                        )}
                      </div>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          צפייה בכתבה
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Status breakdown */}
      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">סטטוס כתבות</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.status_counts).map(([status, count]) => (
            <span
              key={status}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm"
            >
              <StatusBadge status={status} />
              <b>{count}</b>
            </span>
          ))}
        </div>
      </section>

      {/* Pending reports */}
      {reports.length > 0 && (
        <section className="mb-8 rounded-xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-red-800">
            דיווחים לבדיקה ({reports.length})
          </h2>
          <div className="space-y-3">
            {reports.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg bg-white p-3">
                {r.featured_image_url && (
                  <img src={articleImageUrl(r.featured_image_url) ?? undefined} alt="" className="h-12 w-20 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.title_he ?? r.source_url}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {r.category_slug ?? ""} · {r.reason}
                    {r.details ? ` · ${r.details}` : ""}
                  </div>
                </div>
                {r.article_status === "published" && r.category_slug && r.slug_he && (
                  <a
                    href={`/he/${r.category_slug}/${r.slug_he}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    צפה
                  </a>
                )}
                <button
                  onClick={() => call("admin_resolve_report", { p_report: r.id }, r.id)}
                  disabled={busy === r.id}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium hover:bg-zinc-200 disabled:opacity-50"
                >
                  תקין
                </button>
                <button
                  onClick={() => call("admin_resolve_report", { p_report: r.id, p_article_status: "archived" }, r.id)}
                  disabled={busy === r.id}
                  className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  הסר כתבה
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact messages */}
      {messages.length > 0 && (
        <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">הודעות צור קשר ({messages.length})</h2>
          <div className="space-y-3">
            {messages.map((m: any) => (
              <div key={m.id} className={`rounded-lg border p-3 ${m.is_read ? "border-zinc-200 bg-zinc-50 opacity-70" : "border-blue-200 bg-blue-50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <b>{m.name}</b>{" "}
                    <a href={`mailto:${m.email}`} className="text-blue-600 hover:underline">{m.email}</a>
                    <span className="mr-2 text-xs text-zinc-400">
                      {new Date(m.created_at).toLocaleDateString("he-IL")}{" "}
                      {new Date(m.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      {m.locale ? ` · ${m.locale}` : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => call("admin_mark_message", { p_message: m.id, p_read: !m.is_read }, m.id)}
                    disabled={busy === m.id}
                    className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {m.is_read ? "סמן לא נקרא" : "סמן נקרא"}
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{m.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Image gallery */}
      {showGallery && (() => {
        const withImgs = data.recent_articles.filter((a) => a.featured_image_url || a.youtube_video_id);
        const cats = Array.from(new Set(withImgs.map((a) => a.category_slug).filter(Boolean))) as string[];
        const shown = galleryCat === "all" ? withImgs : withImgs.filter((a) => a.category_slug === galleryCat);
        return (
          <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="ml-auto font-semibold">תמונות ({shown.length})</h2>
              <button
                onClick={() => setGalleryCat("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${galleryCat === "all" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
              >
                הכל
              </button>
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setGalleryCat(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${galleryCat === c ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                >
                  {categoryLabel(data.categories.find((x) => x.slug === c)?.name_json, c, "he")}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {shown.map((a) => {
                const img = a.youtube_video_id
                  ? `https://i.ytimg.com/vi/${a.youtube_video_id}/hqdefault.jpg`
                  : (articleImageUrl(a.featured_image_url) ?? "");
                const inner = (
                  <>
                    <img src={img} alt="" className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
                    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>{a.category_slug ?? ""}</span>
                      <span>{a.status === "published" ? "🟢" : "🟡"}</span>
                    </div>
                  </>
                );
                return a.status === "published" && a.category_slug && (a.slug_he || a.slug_en) ? (
                  <a key={a.id} href={`/he/${a.category_slug}/${a.slug_he ?? a.slug_en}`} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80">
                    {inner}
                  </a>
                ) : (
                  <a key={a.id} href={a.source_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80">
                    {inner}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Categories */}
      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <button
          onClick={() => setShowCategories((v) => !v)}
          className="flex w-full items-center justify-between font-semibold"
        >
          <span>נושאים (קטגוריות)</span>
          <span className="text-zinc-400">{showCategories ? "▲" : "▼"}</span>
        </button>
        {showCategories && (
        <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-right text-xs text-zinc-500">
              <th className="py-2">נושא</th>
              <th>כתבות</th>
              <th>מפורסמות</th>
              <th>צפיות</th>
              <th>פעיל</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 font-medium">
                  <button
                    onClick={() => { setFilter(`cat:${c.slug}`); setArtPage(1); }}
                    className={`rounded-md px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-700 ${
                      filter === `cat:${c.slug}` ? "bg-blue-100 text-blue-700" : ""
                    }`}
                  >
                    {categoryLabel(c.name_json, c.slug, "he")}
                  </button>
                </td>
                <td className="text-center">{c.article_count}</td>
                <td className="text-center">{c.published_count}</td>
                <td className="text-center">{c.views}</td>
                <td className="text-center">
                  <Toggle
                    active={c.is_active}
                    disabled={busy === c.id}
                    onChange={() =>
                      call("admin_set_category_active", {
                        p_category: c.id,
                        p_active: !c.is_active,
                      }, c.id)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        )}
        {showCategories && (
          <form
            className="mt-4 rounded-lg border border-dashed border-zinc-300 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCat.slug || !newCat.en) return;
              await call("admin_add_category", {
                p_slug: newCat.slug.toLowerCase().trim(),
                p_name_json: {
                  en: newCat.en,
                  he: newCat.he || newCat.en,
                  es: newCat.es || newCat.en,
                  ar: newCat.ar || newCat.en,
                },
              }, "new-cat");
              setNewCat({ slug: "", en: "", he: "", es: "", ar: "" });
            }}
          >
            <div className="mb-2 text-sm font-medium">הוסף נושא חדש</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(["slug", "en", "he", "es", "ar"] as const).map((f) => (
                <input
                  key={f}
                  value={newCat[f]}
                  onChange={(e) => setNewCat({ ...newCat, [f]: e.target.value })}
                  placeholder={f === "slug" ? "slug (באנגלית)" : `שם ב${{ en: "אנגלית", he: "עברית", es: "ספרדית", ar: "ערבית" }[f]}`}
                  required={f === "slug" || f === "en"}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  dir={f === "slug" || f === "en" ? "ltr" : "auto"}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={busy === "new-cat"}
              className="mt-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === "new-cat" ? "מוסיף..." : "הוסף נושא"}
            </button>
          </form>
        )}
      </section>

      {/* Sources */}
      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <button
          onClick={() => setShowSources((v) => !v)}
          className="flex w-full items-center justify-between font-semibold"
        >
          <span>מקורות תוכן</span>
          <span className="text-zinc-400">{showSources ? "▲" : "▼"}</span>
        </button>
        {showSources && (
        <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-right text-xs text-zinc-500">
              <th className="py-2">מקור</th>
              <th>סוג</th>
              <th>כתבות</th>
              <th>שגיאה אחרונה</th>
              <th>פעיל</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="max-w-48 truncate py-2 font-medium" title={s.url}>
                  <button
                    onClick={() => { setFilter(`src:${s.id}`); setArtPage(1); }}
                    className={`rounded-md px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-700 ${
                      filter === `src:${s.id}` ? "bg-blue-100 text-blue-700" : ""
                    }`}
                  >
                    {s.name}
                  </button>
                </td>
                <td className="text-center">{s.source_type}</td>
                <td className="text-center">{s.article_count}</td>
                <td className="max-w-40 truncate text-center text-xs text-red-600" title={s.last_error ?? ""}>
                  {s.last_error ?? "—"}
                </td>
                <td className="text-center">
                  <Toggle
                    active={s.is_active}
                    disabled={busy === s.id}
                    onChange={() =>
                      call("admin_set_source_active", {
                        p_source: s.id,
                        p_active: !s.is_active,
                      }, s.id)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        )}
      </section>

      {/* Recent articles */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">כתבות אחרונות</h2>
          {filter !== "all" && (
            <button
              onClick={() => { setFilter("all"); setArtPage(1); }}
              className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              נקה סינון ✕
            </button>
          )}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-xs text-zinc-500">
              <th className="py-2">תמונה</th>
              <th className="py-2">כותרת</th>
              <th>סוג</th>
              <th>קטגוריה</th>
              <th>סטטוס</th>
              <th>צפיות</th>
              <th>קליקים</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.recent_articles
              .filter(matchesFilter)
              .slice((artPage - 1) * ART_PAGE_SIZE, artPage * ART_PAGE_SIZE)
              .map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="py-2">
                  {a.youtube_video_id ? (
                    <img
                      src={`https://i.ytimg.com/vi/${a.youtube_video_id}/default.jpg`}
                      alt=""
                      className="h-12 w-20 rounded-md object-cover"
                    />
                  ) : a.featured_image_url ? (
                    <img
                      src={articleImageUrl(a.featured_image_url) ?? undefined}
                      alt=""
                      className="h-12 w-20 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-20 items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-400">
                      ללא תמונה
                    </div>
                  )}
                </td>
                <td className="max-w-64 truncate py-2" title={a.title_he ?? a.title_en ?? a.source_url}>
                  {a.status === "published" && a.category_slug && (a.slug_he || a.slug_en) ? (
                    <a
                      href={`/he/${a.category_slug}/${a.slug_he ?? a.slug_en}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {a.title_he ?? a.title_en ?? a.source_url}
                    </a>
                  ) : (
                    <a
                      href={a.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-600 hover:text-blue-600 hover:underline"
                    >
                      {a.title_he ?? a.title_en ?? a.source_url}
                    </a>
                  )}
                </td>
                <td className="text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.source_type === "video"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {a.source_type === "video" ? "וידאו" : "RSS"}
                  </span>
                </td>
                <td className="text-center text-xs">
                  {a.category_slug ?? "—"}
                  {a.subcategory_name && (
                    <div className="text-[10px] text-blue-600">
                      {a.subcategory_name.he ?? a.subcategory_name.en}
                    </div>
                  )}
                </td>
                <td className="text-center"><StatusBadge status={a.status} /></td>
                <td className="text-center">{a.views}</td>
                <td className="text-center">{a.clicks}</td>
                <td className="text-center">
                  {a.status === "failed" && (
                    <button
                      onClick={() =>
                        call("admin_set_article_status", {
                          p_article: a.id,
                          p_status: "pending",
                        }, a.id)
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      נסה שוב
                    </button>
                  )}
                  {a.status === "published" && (
                    <button
                      onClick={() =>
                        call("admin_set_article_status", {
                          p_article: a.id,
                          p_status: "archived",
                        }, a.id)
                      }
                      className="text-xs text-zinc-500 hover:underline"
                    >
                      הסר
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {(() => {
          const total = data.recent_articles.filter(matchesFilter).length;
          const pages = Math.ceil(total / ART_PAGE_SIZE);
          if (pages <= 1) return null;
          return (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                onClick={() => setArtPage((p) => Math.max(1, p - 1))}
                disabled={artPage === 1}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
              >
                → קודם
              </button>
              <span className="text-zinc-500">
                עמוד {artPage} מתוך {pages} ({total} פריטים)
              </span>
              <button
                onClick={() => setArtPage((p) => Math.min(pages, p + 1))}
                disabled={artPage === pages}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
              >
                הבא ←
              </button>
            </div>
          );
        })()}
      </section>
    </main>
  );
}
