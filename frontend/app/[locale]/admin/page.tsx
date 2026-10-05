"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const ART_PAGE_SIZE = 20;

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
        setError(error.message.includes("unauthorized") ? "טוקן שגוי" : error.message);
        return;
      }
      setData(data as Overview);
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
            טוקן ניהול (מופיע ב־Supabase: admin_config → admin_token)
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
          ["צפיות", t.views, null],
          ["קליקים למקור", t.clicks, null],
          ["מקורות פעילים", data.sources.filter((s) => s.is_active).length, null],
        ] as const).map(([label, value, f]) => (
          <div
            key={label}
            onClick={f ? () => { setFilter(f); setArtPage(1); } : undefined}
            className={`rounded-xl border bg-white p-4 shadow-sm transition ${
              f ? "cursor-pointer hover:border-blue-400" : ""
            } ${filter === f ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-200"}`}
          >
            <div className="text-2xl font-bold text-zinc-900">{value}</div>
            <div className="text-xs text-zinc-500">{label}</div>
          </div>
        ))}
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

      {/* Categories */}
      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">נושאים (קטגוריות)</h2>
        <table className="w-full text-sm">
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
                  {c.name_json?.he ?? c.name_json?.en ?? c.slug}
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
        </table>
      </section>

      {/* Sources */}
      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">מקורות תוכן</h2>
        <table className="w-full text-sm">
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
                  {s.name}
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
        </table>
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
        <table className="w-full text-sm">
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
              .filter((a) =>
                filter === "all"
                  ? true
                  : filter === "pending"
                    ? ["pending", "failed", "extracting", "summarizing", "translating"].includes(a.status)
                    : filter === "rss"
                      ? a.source_type === "news"
                      : filter === "video"
                        ? a.source_type === "video"
                        : a.status === filter,
              )
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
                      src={a.featured_image_url}
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
                <td className="text-center text-xs">{a.category_slug ?? "—"}</td>
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
        </table>
        {(() => {
          const total = data.recent_articles.filter((a) =>
            filter === "all"
              ? true
              : filter === "pending"
                ? ["pending", "failed", "extracting", "summarizing", "translating"].includes(a.status)
                : filter === "rss"
                  ? a.source_type === "news"
                  : filter === "video"
                    ? a.source_type === "video"
                    : a.status === filter,
          ).length;
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
