"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type MySession = {
  id: string;
  topic: string;
  tool: string | null;
  is_public: boolean;
  updated_at: string;
  parent_session_id: string | null;
  havruta_messages?: { count: number }[];
};

const texts: Record<
  string,
  {
    title: string;
    needLogin: string;
    goLogin: string;
    nickname: string;
    nicknamePlaceholder: string;
    save: string;
    saved: string;
    myDiscussions: string;
    empty: string;
    open: string;
    publicBadge: string;
    privateBadge: string;
    makePrivate: string;
    makePublic: string;
    del: string;
    confirmDel: string;
    logout: string;
    lastActive: string;
    msgs: string;
    backHome: string;
  }
> = {
  he: {
    title: "הפרופיל שלי",
    needLogin: "התחבר כדי לראות את הפרופיל שלך — דרך חברותא AI או כל כלי אחר.",
    goLogin: "לחברותא AI",
    nickname: "כינוי",
    nicknamePlaceholder: "הכינוי שיופיע על הדיונים שלך",
    save: "שמור",
    saved: "נשמר ✓",
    myDiscussions: "הדיונים שלי",
    empty: "עוד לא פתחת דיונים.",
    open: "פתח",
    publicBadge: "ציבורי",
    privateBadge: "פרטי",
    makePrivate: "הסתר מהקהילה",
    makePublic: "פרסם בקהילה",
    del: "מחק",
    confirmDel: "למחוק את הדיון לצמיתות?",
    logout: "התנתק",
    lastActive: "פעילות אחרונה",
    msgs: "הודעות",
    backHome: "חזרה לדף הבית",
  },
  en: {
    title: "My profile",
    needLogin: "Sign in to view your profile — via Havruta AI or any other tool.",
    goLogin: "Go to Havruta AI",
    nickname: "Nickname",
    nicknamePlaceholder: "The name shown on your discussions",
    save: "Save",
    saved: "Saved ✓",
    myDiscussions: "My discussions",
    empty: "No discussions yet.",
    open: "Open",
    publicBadge: "Public",
    privateBadge: "Private",
    makePrivate: "Hide from community",
    makePublic: "Show in community",
    del: "Delete",
    confirmDel: "Delete this discussion permanently?",
    logout: "Sign out",
    lastActive: "Last active",
    msgs: "messages",
    backHome: "Back to home",
  },
  es: {
    title: "Mi perfil",
    needLogin: "Inicia sesión para ver tu perfil — a través de Javruta AI u otra herramienta.",
    goLogin: "Ir a Javruta AI",
    nickname: "Apodo",
    nicknamePlaceholder: "El nombre que aparece en tus discusiones",
    save: "Guardar",
    saved: "Guardado ✓",
    myDiscussions: "Mis discusiones",
    empty: "Aún no tienes discusiones.",
    open: "Abrir",
    publicBadge: "Pública",
    privateBadge: "Privada",
    makePrivate: "Ocultar de la comunidad",
    makePublic: "Mostrar en la comunidad",
    del: "Eliminar",
    confirmDel: "¿Eliminar esta discusión permanentemente?",
    logout: "Cerrar sesión",
    lastActive: "Última actividad",
    msgs: "mensajes",
    backHome: "Volver al inicio",
  },
  ar: {
    title: "ملفي الشخصي",
    needLogin: "سجّل الدخول لعرض ملفك — عبر حَبروتا AI أو أي أداة أخرى.",
    goLogin: "إلى حَبروتا AI",
    nickname: "اللقب",
    nicknamePlaceholder: "الاسم الذي يظهر في نقاشاتك",
    save: "حفظ",
    saved: "تم الحفظ ✓",
    myDiscussions: "نقاشاتي",
    empty: "لا توجد نقاشات بعد.",
    open: "افتح",
    publicBadge: "عام",
    privateBadge: "خاص",
    makePrivate: "إخفاء من المجتمع",
    makePublic: "إظهار في المجتمع",
    del: "حذف",
    confirmDel: "حذف هذا النقاش نهائيًا؟",
    logout: "تسجيل الخروج",
    lastActive: "آخر نشاط",
    msgs: "رسائل",
    backHome: "عودة للرئيسية",
  },
};

const TOOL_META: Record<string, { icon: string; path: string }> = {
  havruta: { icon: "📖", path: "havruta" },
  teacher: { icon: "🎓", path: "teacher" },
  shadchan: { icon: "💞", path: "shadchan" },
};

export function Profile({ locale }: { locale: string }) {
  const t = texts[locale] ?? texts.he;
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [ready, setReady] = useState(false);
  const [nick, setNick] = useState("");
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setAccessToken(data.session?.access_token ?? "");
      setNick(
        (u?.user_metadata?.full_name as string) ||
          (u?.user_metadata?.name as string) ||
          "",
      );
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      setAccessToken(s?.access_token ?? "");
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/havruta?mine=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((j) => setSessions(Array.isArray(j.sessions) ? j.sessions : []))
      .catch(() => {});
  }, [accessToken]);

  async function saveNick() {
    const name = nick.trim().slice(0, 60);
    if (!name) return;
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name },
    });
    if (!error) {
      setUser(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      try {
        localStorage.setItem("havruta_name", name);
      } catch {}
    }
  }

  async function togglePrivacy(s: MySession) {
    if (busyId) return;
    setBusyId(s.id);
    try {
      const res = await fetch("/api/havruta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sessionId: s.id, isPublic: !s.is_public }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, is_public: !x.is_public } : x)),
        );
      }
    } catch {}
    setBusyId(null);
  }

  async function removeSession(s: MySession) {
    if (!window.confirm(t.confirmDel)) return;
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/havruta?session=${s.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {}
    setBusyId(null);
  }

  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email ||
    "";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3">
        <a href={`/${locale}`} className="text-xs text-amber-700 hover:underline">
          {locale === "he" || locale === "ar" ? "→" : "←"} {t.backHome}
        </a>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">{t.title}</h1>

        {!ready ? (
          <p className="text-sm text-zinc-400">…</p>
        ) : !user ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
            <p className="mb-3 text-sm text-blue-800">{t.needLogin}</p>
            <a
              href={`/${locale}/havruta`}
              className="inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              🔐 {t.goLogin}
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              {avatar ? (
                <img src={avatar} alt="" className="h-14 w-14 rounded-full border border-zinc-200" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-200 text-2xl">
                  👤
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-zinc-900">{displayName}</p>
                <p className="truncate text-xs text-zinc-500" dir="ltr">{user.email}</p>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="ms-auto shrink-0 text-xs text-zinc-400 hover:text-red-600 hover:underline"
              >
                {t.logout}
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t.nickname}</label>
              <div className="flex gap-2">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  placeholder={t.nicknamePlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
                />
                <button
                  onClick={saveNick}
                  disabled={!nick.trim()}
                  className="shrink-0 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  {saved ? t.saved : t.save}
                </button>
              </div>
            </div>

            <div className="border-t border-amber-100 pt-4">
              <p className="mb-3 text-xs font-medium text-zinc-500">
                {t.myDiscussions} · {sessions.length}
              </p>
              {sessions.length === 0 ? (
                <p className="text-sm text-zinc-400">{t.empty}</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => {
                    const meta = TOOL_META[s.tool ?? "havruta"] ?? TOOL_META.havruta;
                    const count = s.havruta_messages?.[0]?.count ?? 0;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
                      >
                        <a
                          href={`/${locale}/${meta.path}?s=${s.id}`}
                          className="flex min-w-0 flex-1 items-center gap-2 text-xs text-zinc-800 hover:text-amber-700"
                        >
                          <span>{meta.icon}</span>
                          <span className="truncate font-medium">
                            {s.parent_session_id ? "🌿 " : ""}{s.topic}
                          </span>
                        </a>
                        <span className="hidden shrink-0 text-[10px] text-zinc-400 sm:inline">
                          {count} {t.msgs} · {new Date(s.updated_at).toLocaleDateString(locale)}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            s.is_public
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-zinc-200 text-zinc-600"
                          }`}
                        >
                          {s.is_public ? `🌐 ${t.publicBadge}` : `🙈 ${t.privateBadge}`}
                        </span>
                        <button
                          onClick={() => togglePrivacy(s)}
                          disabled={busyId === s.id}
                          title={s.is_public ? t.makePrivate : t.makePublic}
                          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                        >
                          {s.is_public ? "🙈" : "🌐"}
                        </button>
                        <button
                          onClick={() => removeSession(s)}
                          disabled={busyId === s.id}
                          title={t.del}
                          className="shrink-0 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
