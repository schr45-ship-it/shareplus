"use client";

import { useEffect, useMemo, useState } from "react";

type VaultEntry = {
  id: string;
  name: string;
  url: string | null;
  category: string;
  username: string | null;
  secret: string | null;
  notes: string | null;
};

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  hosting: { label: "אירוח", icon: "🖥️" },
  domain: { label: "דומיין", icon: "🌐" },
  database: { label: "מסד נתונים", icon: "🗄️" },
  ads: { label: "פרסום", icon: "💰" },
  email: { label: "אימייל", icon: "📧" },
  social: { label: "רשתות", icon: "📱" },
  tools: { label: "כלים", icon: "🧰" },
  payment: { label: "תשלומים", icon: "💳" },
  other: { label: "אחר", icon: "📌" },
};

const EMPTY_FORM = { name: "", url: "", category: "other", username: "", secret: "", notes: "" };

export default function VaultPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function api(method: string, body?: unknown, qs = "") {
    const res = await fetch(`/api/vault${qs}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token ?? "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  async function load(t?: string | null) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/vault", {
      headers: { "x-admin-token": t ?? token ?? "" },
    });
    if (res.status === 401) {
      setToken(null);
      localStorage.removeItem("admin_token");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setEntries(Array.isArray(json.entries) ? json.entries : []);
    setLoading(false);
  }

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (t) {
      setToken(t);
      load(t);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/vault", { headers: { "x-admin-token": tokenInput } });
    if (res.status === 401) {
      setError("סיסמת ניהול שגויה");
      return;
    }
    localStorage.setItem("admin_token", tokenInput);
    setToken(tokenInput);
    const json = await res.json();
    setEntries(Array.isArray(json.entries) ? json.entries : []);
    setError(null);
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    if (editing) {
      await api("PATCH", { id: editing.id, ...form });
    } else {
      await api("POST", form);
    }
    setBusy(false);
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    load();
  }

  async function removeEntry(id: string) {
    if (!confirm("למחוק את הרשומה לצמיתות?")) return;
    await api("DELETE", undefined, `?id=${id}`);
    load();
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.url ?? "").toLowerCase().includes(q) ||
        (e.username ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, query, filterCat]);

  const usedCats = useMemo(
    () => [...new Set(entries.map((e) => e.category))],
    [entries],
  );

  if (!token && !loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-4 text-center text-4xl">🔐</div>
          <h1 className="mb-1 text-center text-2xl font-bold text-zinc-900">הכספת</h1>
          <p className="mb-6 text-center text-sm text-zinc-500">סיסמת הניהול שלך</p>
          <form onSubmit={login} className="flex flex-col gap-3">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="סיסמת ניהול"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
              autoFocus
            />
            <button className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
              כניסה
            </button>
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">🔐 הכספת</h1>
          <p className="text-sm text-zinc-500">אתרים, מערכות, סיסמאות והסברים — מרוכזים במקום אחד</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setShowForm(true);
          }}
          className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          + רשומה חדשה
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש: שם, כתובת, משתמש, הערות..."
          className="min-w-56 flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
        >
          <option value="all">כל הקטגוריות ({entries.length})</option>
          {usedCats.map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c]?.icon} {CATEGORIES[c]?.label ?? c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-400">טוען...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
          <div className="mb-2 text-4xl">🗝️</div>
          <p className="text-sm text-zinc-500">
            {entries.length === 0 ? "הכספת ריקה. לחץ על \"רשומה חדשה\" כדי להתחיל." : "אין תוצאות לחיפוש."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((e) => {
            const cat = CATEGORIES[e.category] ?? CATEGORIES.other;
            const reveal = showSecrets[e.id];
            return (
              <div key={e.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <div>
                      <div className="font-semibold text-zinc-900">{e.name}</div>
                      <div className="text-[11px] text-zinc-400">{cat.label}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(e);
                        setForm({
                          name: e.name,
                          url: e.url ?? "",
                          category: e.category,
                          username: e.username ?? "",
                          secret: e.secret ?? "",
                          notes: e.notes ?? "",
                        });
                        setShowForm(true);
                      }}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs hover:bg-zinc-50"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {e.url && (
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-blue-600 hover:underline"
                    >
                      {e.url}
                    </a>
                    <button onClick={() => copy(e.url!, `url-${e.id}`)} className="shrink-0 text-zinc-400 hover:text-zinc-700">
                      {copied === `url-${e.id}` ? "✅" : "📋"}
                    </button>
                  </div>
                )}
                {e.username && (
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">משתמש:</span>
                    <span className="font-mono text-zinc-700">{e.username}</span>
                    <button onClick={() => copy(e.username!, `u-${e.id}`)} className="text-zinc-400 hover:text-zinc-700">
                      {copied === `u-${e.id}` ? "✅" : "📋"}
                    </button>
                  </div>
                )}
                {e.secret && (
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">סיסמה:</span>
                    <span className="font-mono text-zinc-700">
                      {reveal ? e.secret : "••••••••"}
                    </span>
                    <button
                      onClick={() => setShowSecrets((s) => ({ ...s, [e.id]: !s[e.id] }))}
                      className="text-zinc-400 hover:text-zinc-700"
                    >
                      {reveal ? "🙈" : "👁️"}
                    </button>
                    <button onClick={() => copy(e.secret!, `s-${e.id}`)} className="text-zinc-400 hover:text-zinc-700">
                      {copied === `s-${e.id}` ? "✅" : "📋"}
                    </button>
                  </div>
                )}
                {e.notes && (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-2.5 text-xs leading-relaxed text-zinc-600">
                    {e.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <form
            onSubmit={saveEntry}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-bold text-zinc-900">
              {editing ? "עריכת רשומה" : "רשומה חדשה"}
            </h2>
            <div className="flex flex-col gap-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="שם המערכת / האתר *"
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
                autoFocus
              />
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="כתובת URL"
                dir="ltr"
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-left text-sm focus:border-amber-400 focus:outline-none"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm"
              >
                {Object.entries(CATEGORIES).map(([k, c]) => (
                  <option key={k} value={k}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="שם משתמש / אימייל"
                dir="ltr"
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-left text-sm focus:border-amber-400 focus:outline-none"
              />
              <input
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="סיסמה / מפתח API"
                dir="ltr"
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-left text-sm focus:border-amber-400 focus:outline-none"
              />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="הסברים — איך המערכת עובדת, הוראות תחזוקה, קישורים לדוקומנטציה..."
                rows={4}
                className="resize-none rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={busy || !form.name.trim()}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                {editing ? "שמור שינויים" : "הוסף"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
