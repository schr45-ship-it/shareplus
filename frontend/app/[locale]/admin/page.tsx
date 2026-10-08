"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { articleImageUrl, categoryLabel } from "@/lib/site";
import {
  adminBlockedTags,
  adminBlockTag,
  adminUnblockTag,
  adminGetArticle,
  adminUpdateArticle,
  adminSearchArticles,
} from "@/lib/supabase/queries";

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
  const [blockedTags, setBlockedTags] = useState<{ tag: string; reason: string | null; created_at: string }[]>([]);
  const [blockedTagInput, setBlockedTagInput] = useState("");
  const [blockedTagReason, setBlockedTagReason] = useState("");
  const [showBlockedTags, setShowBlockedTags] = useState(false);
  const [blockedTagStatus, setBlockedTagStatus] = useState<string | null>(null);
  const [imageEdits, setImageEdits] = useState<Record<string, string>>({});
  const [articleSearch, setArticleSearch] = useState("");
  const [articleSearchResults, setArticleSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    body: "",
    tags: "",
    category: "",
    imageUrl: "",
    status: "",
    language: "he",
  });
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSeed, setImageSeed] = useState(0);
  const [newCat, setNewCat] = useState({ slug: "", en: "", he: "", es: "", ar: "" });
  const [articleTopic, setArticleTopic] = useState("");
  const [articleLanguage, setArticleLanguage] = useState("he");
  const [articleLong, setArticleLong] = useState(true);
  const [articleRequestStatus, setArticleRequestStatus] = useState<string | null>(null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manualDraft, setManualDraft] = useState({
    title: "",
    body: "",
    category: "",
    tags: "",
    youtubeUrl: "",
  });
  const [manualImage, setManualImage] = useState<File | null>(null);
  const [manualVideo, setManualVideo] = useState<File | null>(null);
  const [manualTranslations, setManualTranslations] = useState<string[]>([]);
  const [manualStatus, setManualStatus] = useState<string | null>(null);
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
      const tags = await adminBlockedTags(t);
      setBlockedTags(tags);
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

  async function uploadManualMedia(file: File) {
    if (!savedToken) throw new Error("אין הרשאת ניהול");
    const signed = await fetch("/api/admin/media-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: savedToken, filename: file.name, contentType: file.type }),
    });
    const upload = await signed.json();
    if (!signed.ok) throw new Error(upload.error || "יצירת קישור העלאה נכשלה");
    const result = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) throw new Error("העלאת הקובץ נכשלה");
    return upload.publicUrl as string;
  }

  async function createManualArticle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!savedToken) return;
    setBusy("manual-article");
    setManualStatus(null);
    try {
      if (manualImage && manualImage.size > 10 * 1024 * 1024) throw new Error("תמונה יכולה להיות עד 10MB");
      if (manualVideo && manualVideo.size > 200 * 1024 * 1024) throw new Error("סרטון יכול להיות עד 200MB");
      const imageUrl = manualImage ? await uploadManualMedia(manualImage) : null;
      const videoUrl = manualVideo ? await uploadManualMedia(manualVideo) : null;
      const youtubeMatch = manualDraft.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
      const { error } = await (supabase.rpc as any)("admin_create_manual_article", {
        p_token: savedToken,
        p_title: manualDraft.title.trim(),
        p_body: manualDraft.body.trim(),
        p_category_slug: manualDraft.category,
        p_tags: manualDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
        p_image_url: imageUrl,
        p_video_url: videoUrl,
        p_youtube_url: manualDraft.youtubeUrl.trim() || null,
        p_youtube_video_id: youtubeMatch?.[1] || null,
        p_translate_languages: manualTranslations,
      });
      if (error) throw new Error(error.message);
      setManualDraft({ title: "", body: "", category: "", tags: "", youtubeUrl: "" });
      setManualImage(null);
      setManualVideo(null);
      setManualTranslations([]);
      setManualStatus(manualTranslations.length ? "הכתבה נוספה ותפורסם לאחר התרגום." : "הכתבה פורסמה בהצלחה.");
      await load(savedToken);
    } catch (error) {
      setManualStatus(`שגיאה: ${error instanceof Error ? error.message : "הפעולה נכשלה"}`);
    }
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

  async function searchAdminArticles(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!savedToken || articleSearch.trim().length < 2) return;
    setSearching(true);
    const query = articleSearch.trim().toLowerCase();
    const { results, error } = await adminSearchArticles(savedToken, articleSearch.trim());
    if (error) {
      setError(`חיפוש נכשל: ${error}`);
    }
    if (results.length > 0) {
      setArticleSearchResults(results);
    } else {
      // Fallback: search within the 500 recent articles client-side
      const local = (data?.recent_articles ?? []).filter((a) => {
        const title = (a.title_he ?? a.title_en ?? "").toLowerCase();
        const slug = (a.slug_he ?? a.slug_en ?? "").toLowerCase();
        const source = (a.source_url ?? "").toLowerCase();
        return title.includes(query) || slug.includes(query) || source.includes(query) || a.id.toLowerCase().includes(query);
      });
      setArticleSearchResults(local);
    }
    setSearching(false);
  }

  async function openArticleEditor(article: any) {
    if (!savedToken) return;
    setEditingArticle(article);
    setEditStatus(null);
    const details = await adminGetArticle(savedToken, article.id, "he");
    if (details) {
      setEditForm({
        title: String(details.title || ""),
        body: String(details.body || ""),
        tags: Array.isArray(details.tags) ? details.tags.join(", ") : "",
        category: String(details.category_slug || ""),
        imageUrl: String(details.featured_image_url || ""),
        status: String(details.status || ""),
        language: String(details.language || "he"),
      });
    } else {
      setEditStatus("לא ניתן לטעון את הכתבה לעריכה.");
    }
  }

  async function saveArticleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!savedToken || !editingArticle) return;
    setBusy("edit-article");
    setEditStatus(null);
    const result = await adminUpdateArticle(savedToken, editingArticle.id, {
      language: editForm.language,
      title: editForm.title.trim(),
      body: editForm.body.trim(),
      tags: editForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
      category_slug: editForm.category.trim() || null,
      image_url: editForm.imageUrl.trim() || null,
      status: editForm.status.trim() || null,
    });
    if (result.success) {
      setEditStatus("הכתבה נשמרה בהצלחה.");
      await load(savedToken);
      if (articleSearch.trim()) {
        const { results } = await adminSearchArticles(savedToken, articleSearch.trim());
        setArticleSearchResults(results);
      }
    } else {
      setEditStatus(`שגיאה: ${result.error || "לא ניתן היה לשמור את הכתבה."}`);
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
        <div className="flex items-center gap-2">
          <a
            href="/he/admin/vault"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            🔐 הכספת
          </a>
          <button
            onClick={() => load(savedToken)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            רענון
          </button>
        </div>
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

      <section className="mb-8 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowManualEditor((value) => !value)}
          className="flex w-full items-center justify-between bg-emerald-50 p-5 text-right hover:bg-emerald-100"
          aria-expanded={showManualEditor}
        >
          <span>
            <b className="block text-emerald-950">הוספת כתבה ידנית</b>
            <span className="text-sm text-emerald-700">כותרת, תוכן, תמונה או סרטון ותרגום אופציונלי</span>
          </span>
          <span className="text-xl text-emerald-700">{showManualEditor ? "−" : "+"}</span>
        </button>

        {showManualEditor && (
          <form onSubmit={createManualArticle} className="space-y-4 border-t border-emerald-200 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700">
                כותרת הכתבה
                <input
                  value={manualDraft.title}
                  onChange={(e) => setManualDraft((draft) => ({ ...draft, title: e.target.value }))}
                  minLength={3}
                  maxLength={180}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                קטגוריה
                <select
                  value={manualDraft.category}
                  onChange={(e) => setManualDraft((draft) => ({ ...draft, category: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal"
                >
                  <option value="">בחר קטגוריה</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {categoryLabel(category.name_json, category.slug, "he")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-zinc-700">
              תוכן הכתבה
              <textarea
                value={manualDraft.body}
                onChange={(e) => setManualDraft((draft) => ({ ...draft, body: e.target.value }))}
                minLength={20}
                maxLength={50000}
                rows={10}
                required
                placeholder="כתוב כאן את הכתבה המלאה. הפרד פסקאות בשורה ריקה."
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal leading-relaxed"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              תגיות, מופרדות בפסיקים
              <input
                value={manualDraft.tags}
                onChange={(e) => setManualDraft((draft) => ({ ...draft, tags: e.target.value }))}
                placeholder="לדוגמה: בינה מלאכותית, עסקים, מדריך"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700">
                תמונה ראשית
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setManualImage(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-normal"
                />
                <span className="mt-1 block text-xs font-normal text-zinc-400">JPG, PNG או WebP עד 10MB</span>
              </label>
              <label className="text-sm font-medium text-zinc-700">
                העלאת סרטון
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setManualVideo(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-normal"
                />
                <span className="mt-1 block text-xs font-normal text-zinc-400">MP4, WebM או MOV עד 200MB</span>
              </label>
            </div>

            <label className="block text-sm font-medium text-zinc-700">
              או קישור YouTube
              <input
                type="url"
                value={manualDraft.youtubeUrl}
                onChange={(e) => setManualDraft((draft) => ({ ...draft, youtubeUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal" dir="ltr"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-zinc-700">תרגם גם ל…</legend>
              <div className="flex flex-wrap gap-4">
                {[["en", "אנגלית"], ["es", "ספרדית"], ["ar", "ערבית"]].map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={manualTranslations.includes(code)}
                      onChange={(e) => setManualTranslations((languages) =>
                        e.target.checked ? [...languages, code] : languages.filter((language) => language !== code)
                      )}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {manualStatus && (
              <p className={`rounded-lg px-3 py-2 text-sm ${manualStatus.startsWith("שגיאה") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {manualStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={busy === "manual-article"}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "manual-article" ? "מעלה ושומר..." : manualTranslations.length ? "שמור ושלח לתרגום" : "פרסם כתבה"}
            </button>
          </form>
        )}
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
                  onClick={() => openArticleEditor({ id: r.article_id })}
                  className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
                >
                  ערוך
                </button>
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

      {/* Blocked tags */}
      <section className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowBlockedTags((value) => !value)}
          className="flex w-full items-center justify-between bg-red-50 p-5 text-right hover:bg-red-100"
          aria-expanded={showBlockedTags}
        >
          <span className="font-semibold text-red-950">
            תגיות חסומות ({blockedTags.length})
          </span>
          <span className="text-red-800">{showBlockedTags ? "▲" : "▼"}</span>
        </button>

        {showBlockedTags && (
          <div className="border-t border-zinc-200 p-5 space-y-4">
            <p className="text-sm text-zinc-600">
              כתבות שמכילות תגית חסומה יוסתרו מדפי הבית, קטגוריות, חיפוש, גלריה, תגיות ומפת האתר. כתבות ישנות שנחסמו ייעלמו לאחר הרענון הבא.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!savedToken || !blockedTagInput.trim()) return;
                setBusy("block-tag");
                setBlockedTagStatus(null);
                const result = await adminBlockTag(savedToken, blockedTagInput.trim(), blockedTagReason.trim() || undefined);
                if (result.success) {
                  setBlockedTagInput("");
                  setBlockedTagReason("");
                  setBlockedTagStatus("התגית נוספה לרשימת החסימה.");
                  const tags = await adminBlockedTags(savedToken);
                  setBlockedTags(tags);
                } else {
                  setBlockedTagStatus(`שגיאה: ${result.error || "לא ניתן היה לחסום את התגית."} ודא שהרצת את supabase/migrations/015_block_tags.sql.`);
                }
                setBusy(null);
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <label className="flex-1 min-w-[160px] text-sm font-medium text-zinc-700">
                תגית לחסימה
                <input
                  value={blockedTagInput}
                  onChange={(e) => setBlockedTagInput(e.target.value)}
                  placeholder="לדוגמה: פורנהאב"
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="flex-[2] min-w-[200px] text-sm font-medium text-zinc-700">
                סיבה (אופציונלי)
                <input
                  value={blockedTagReason}
                  onChange={(e) => setBlockedTagReason(e.target.value)}
                  placeholder="לדוגמה: תוכן פוגני"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal"
                />
              </label>
              <button
                type="submit"
                disabled={busy === "block-tag" || !blockedTagInput.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === "block-tag" ? "מוסיף..." : "חסום תגית"}
              </button>
            </form>

            {blockedTagStatus && (
              <p className={`text-sm ${blockedTagStatus.startsWith("שגיאה") ? "text-red-700" : "text-green-700"}`}>
                {blockedTagStatus}
              </p>
            )}

            {blockedTags.length === 0 ? (
              <p className="text-sm text-zinc-500">אין תגיות חסומות כרגע.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {blockedTags.map((bt) => (
                  <span
                    key={bt.tag}
                    className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-sm text-red-900"
                    title={bt.reason ?? ""}
                  >
                    {bt.tag}
                    <button
                      onClick={async () => {
                        if (!savedToken) return;
                        setBusy(`unblock-${bt.tag}`);
                        const result = await adminUnblockTag(savedToken, bt.tag);
                        if (result.success) {
                          const tags = await adminBlockedTags(savedToken);
                          setBlockedTags(tags);
                        } else {
                          setBlockedTagStatus(`שגיאה: ${result.error || "לא ניתן היה להסיר את החסימה."}`);
                        }
                        setBusy(null);
                      }}
                      disabled={busy === `unblock-${bt.tag}`}
                      className="text-red-700 hover:text-red-950 disabled:opacity-50"
                      aria-label={`הסר חסימה של ${bt.tag}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

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
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">כתבות אחרונות</h2>
          <form onSubmit={searchAdminArticles} className="flex gap-2">
            <input
              type="search"
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder="חיפוש לפי כותרת, slug או מקור..."
              minLength={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm sm:w-72"
            />
            <button
              type="submit"
              disabled={searching || articleSearch.trim().length < 2}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {searching ? "מחפש..." : "חפש"}
            </button>
            {articleSearchResults.length > 0 && (
              <button
                type="button"
                onClick={() => { setArticleSearch(""); setArticleSearchResults([]); }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                נקה
              </button>
            )}
          </form>
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
            {articleSearch.trim() && articleSearchResults.length === 0 && !searching ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-zinc-500">
                  לא נמצאו תוצאות לחיפוש „{articleSearch}”.
                </td>
              </tr>
            ) : (
              (articleSearchResults.length > 0
                ? articleSearchResults
                : data.recent_articles
                    .filter(matchesFilter)
                    .slice((artPage - 1) * ART_PAGE_SIZE, artPage * ART_PAGE_SIZE)
              ).map((a) => (
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
                  <div className="flex flex-col items-center gap-1.5">
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
                    {a.status === "published" && !a.youtube_video_id && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const url = imageEdits[a.id]?.trim();
                          if (!url || !savedToken) return;
                          setBusy(`img-${a.id}`);
                          await call("admin_set_article_image", { p_article: a.id, p_url: url }, `img-${a.id}`);
                          setImageEdits((prev) => ({ ...prev, [a.id]: "" }));
                          setBusy(null);
                        }}
                        className="flex flex-col items-center gap-1"
                      >
                        <input
                          type="url"
                          value={imageEdits[a.id] ?? ""}
                          onChange={(e) => setImageEdits((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="החלף תמונה (URL)"
                          className="w-32 rounded-md border border-zinc-300 px-1.5 py-1 text-[11px]"
                          dir="ltr"
                        />
                        <button
                          type="submit"
                          disabled={busy === `img-${a.id}` || !(imageEdits[a.id]?.trim())}
                          className="text-[11px] text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {busy === `img-${a.id}` ? "שומר..." : "עדכן תמונה"}
                        </button>
                      </form>
                    )}
                    <button
                      onClick={() => openArticleEditor(a)}
                      disabled={busy === `edit-${a.id}`}
                      className="text-[11px] text-blue-600 hover:underline disabled:opacity-50"
                    >
                      ערוך כתבה
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table></div>
        {(() => {
          if (articleSearchResults.length > 0) return null;
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

      {/* Article editor modal */}
      {editingArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingArticle(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">עריכת כתבה</h2>
              <button
                onClick={() => setEditingArticle(null)}
                className="rounded-lg bg-zinc-100 px-3 py-1 text-sm hover:bg-zinc-200"
              >
                סגור
              </button>
            </div>

            <form onSubmit={saveArticleEdit} className="space-y-4">
              <label className="block text-sm font-medium text-zinc-700">
                שפה
                <select
                  value={editForm.language}
                  onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                >
                  <option value="he">עברית</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="ar">العربية</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-zinc-700">
                כותרת
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  minLength={3}
                  maxLength={180}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700">
                תוכן
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  required
                  minLength={20}
                  rows={12}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 leading-relaxed"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700">
                תגיות (מופרדות בפסיקים)
                <input
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="לדוגמה: מדע, פיזיקה, נובל"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-zinc-700">
                  קטגוריה
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                  >
                    <option value="">ללא שינוי</option>
                    {data?.categories.map((category) => (
                      <option key={category.id} value={category.slug}>
                        {categoryLabel(category.name_json, category.slug, "he")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-zinc-700">
                  סטטוס
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                  >
                    <option value="">ללא שינוי</option>
                    <option value="published">מפורסם</option>
                    <option value="archived">בארכיון</option>
                    <option value="pending">בתור</option>
                    <option value="rejected">נדחה</option>
                  </select>
                </label>
              </div>

              <div className="block text-sm font-medium text-zinc-700">
                תמונה ראשית
                <input
                  type="url"
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal"
                  dir="ltr"
                />
                <div className="mt-2 flex gap-2">
                  <input
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="תאר מה תרצה בתמונה... (או השאר ריק לשימוש בכותרת)"
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const prompt = (imagePrompt.trim() || editForm.title || "editorial news illustration").trim();
                      const seed = Math.floor(Math.random() * 100000);
                      setImageSeed(seed);
                      setEditForm({
                        ...editForm,
                        imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=675&nologo=true&seed=${seed}`,
                      });
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    צור תמונה 🎨
                  </button>
                </div>
                {editForm.imageUrl && (
                  <div className="mt-2">
                    <img
                      key={`${editForm.imageUrl}-${imageSeed}`}
                      src={editForm.imageUrl}
                      alt="תצוגה מקדימה"
                      className="h-32 w-full rounded-lg border border-zinc-200 object-cover"
                    />
                    <p className="mt-1 text-[10px] font-normal text-zinc-400">
                      תמונה חדשה נוצרת ברקע — ההצגה עשויה לקחת כמה שניות. שמור שינויים כדי להחיל.
                    </p>
                  </div>
                )}
              </div>

              {editStatus && (
                <p className={`text-sm ${editStatus.startsWith("שגיאה") ? "text-red-700" : "text-green-700"}`}>
                  {editStatus}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy === "edit-article"}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy === "edit-article" ? "שומר..." : "שמור שינויים"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm hover:bg-zinc-50"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
