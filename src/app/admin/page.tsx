"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { getIdToken } from "firebase/auth";

import { getClientAuth } from "@/lib/firebaseClient";

type Stats = {
  users: number;
  interestRequests: number;
  approvedRequests: number;
  closedRequests: number;
  completedProcess: number;
  couponReveals: number;
  paidLeads?: number;
  paid: number;
};

type AdminUserListItem = {
  uid: string;
  email: string;
  phone: string;
};

type AdminUserDetails = {
  user: {
    uid: string;
    email: string;
    phone: string;
    displayName?: string;
    notificationPreferences?: { pushEnabled?: boolean; emailEnabled?: boolean };
  };
  counts: { stations: number; requestsAsOwner: number; requestsAsDriver: number };
  stations: Array<{ id: string; title: string; city: string; address: string; active: boolean }>;
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const [purgeDays, setPurgeDays] = useState<number>(30);
  const [purgeIncludePending, setPurgeIncludePending] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeOk, setPurgeOk] = useState<string | null>(null);

  const [view, setView] = useState<"stats" | "users">("stats");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersQuery, setUsersQuery] = useState<string>("");
  const [allUsers, setAllUsers] = useState<AdminUserListItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);

  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPrefPush, setEditPrefPush] = useState(true);
  const [editPrefEmail, setEditPrefEmail] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => {
      return (
        u.uid.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
      );
    });
  }, [allUsers, usersQuery]);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const items = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "משתמשים", value: stats.users, key: "users" as const },
      { label: "בקשות", value: stats.interestRequests },
      { label: "בקשות שאושרו", value: stats.approvedRequests },
      { label: "בקשות שנסגרו", value: stats.closedRequests },
      { label: "עברו את כל התהליך", value: stats.completedProcess },
      { label: "נחשפו עם קופון", value: stats.couponReveals },
      { label: "שילמו (לידים)", value: stats.paidLeads ?? 0 },
      { label: "שילמו (סה\"כ)", value: stats.paid },
    ];
  }, [stats]);

  async function loadUsers() {
    try {
      setUsersError(null);
      if (!user) {
        setUsersError("נדרשת התחברות");
        return;
      }
      setUsersLoading(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/users", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        users?: AdminUserListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת משתמשים");
      setAllUsers(Array.isArray(json.users) ? json.users : []);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setUsersLoading(false);
    }
  }

  async function purgeOldRequests() {
    try {
      setPurgeError(null);
      setPurgeOk(null);
      if (!user) {
        setPurgeError("נדרשת התחברות");
        return;
      }

      const ok = window.confirm(
        `למחוק בקשות טעינה ישנות?\n\nימים: ${purgeDays}\nכולל ממתינות: ${purgeIncludePending ? "כן" : "לא"}\n\nלא ניתן לשחזר.`
      );
      if (!ok) return;

      setPurgeLoading(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/interest-requests/purge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          olderThanDays: purgeDays,
          includePending: purgeIncludePending,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        deleted?: number;
      };
      if (!res.ok) throw new Error(json.error ?? "שגיאה במחיקה");

      setPurgeOk(`נמחקו ${(json.deleted ?? 0).toLocaleString("he-IL")} בקשות`);
      setTimeout(() => setPurgeOk(null), 2500);
      await refresh();
    } catch (e) {
      setPurgeError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setPurgeLoading(false);
    }
  }

  async function loadUserDetails(uid: string) {
    try {
      setDetailsError(null);
      setSaveError(null);
      setSaveOk(null);
      if (!user) {
        setDetailsError("נדרשת התחברות");
        return;
      }
      setDetailsLoading(true);
      const token = await getIdToken(user);
      const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as AdminUserDetails & {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת משתמש");
      setDetails(json);

      setEditEmail(json.user?.email ?? "");
      setEditPhone(json.user?.phone ?? "");
      setEditDisplayName(json.user?.displayName ?? "");
      setEditPrefPush(json.user?.notificationPreferences?.pushEnabled ?? true);
      setEditPrefEmail(json.user?.notificationPreferences?.emailEnabled ?? true);
    } catch (e) {
      setDetailsError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function saveUserEdits() {
    try {
      setSaveError(null);
      setSaveOk(null);
      if (!user) {
        setSaveError("נדרשת התחברות");
        return;
      }
      if (!selectedUid) {
        setSaveError("בחר משתמש");
        return;
      }

      setSaveLoading(true);
      const token = await getIdToken(user);
      const res = await fetch(`/api/admin/users/${encodeURIComponent(selectedUid)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: editEmail.trim(),
          phone: editPhone.trim(),
          displayName: editDisplayName.trim() ? editDisplayName.trim() : undefined,
          notificationPreferences: {
            pushEnabled: editPrefPush,
            emailEnabled: editPrefEmail,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: { uid: string; email: string; phone: string };
      };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בשמירה");

      if (json.user) {
        setAllUsers((prev) =>
          prev.map((u) => (u.uid === json.user!.uid ? { ...u, email: json.user!.email, phone: json.user!.phone } : u))
        );
      }

      setSaveOk("נשמר");
      setTimeout(() => setSaveOk(null), 1500);
      await loadUserDetails(selectedUid);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setSaveLoading(false);
    }
  }

  async function refresh() {
    try {
      setError(null);
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }
      setLoading(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/stats", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as Partial<Stats> & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת נתונים");
      setStats(json as Stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authReady && user) void refresh();
  }, [authReady, user]);

  useEffect(() => {
    if (view !== "users") return;
    if (!authReady || !user) return;
    void loadUsers();
  }, [authReady, user, view]);

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <div />
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה
          </a>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">ניהול</h1>
              <div className="mt-1 text-sm text-zinc-600">נתוני שימוש במיזם</div>
            </div>
            <div className="flex items-center gap-2">
              {view !== "stats" ? (
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  onClick={() => {
                    setView("stats");
                    setUsersError(null);
                    setDetailsError(null);
                    setSelectedUid("");
                    setDetails(null);
                  }}
                >
                  חזרה
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                disabled={loading || usersLoading || detailsLoading}
                onClick={() => {
                  if (view === "stats") void refresh();
                  if (view === "users") void loadUsers();
                }}
              >
                רענן
              </button>
            </div>
          </div>

          {authReady && !user ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              נדרשת התחברות.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {view === "stats" ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((it) => {
                  const clickable = it.key === "users";
                  if (clickable) {
                    return (
                      <button
                        key={it.label}
                        type="button"
                        className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-right hover:bg-zinc-100"
                        onClick={() => {
                          setView("users");
                        }}
                      >
                        <div className="text-xs font-medium text-zinc-500">{it.label}</div>
                        <div className="mt-1 text-2xl font-semibold text-zinc-900">
                          {typeof it.value === "number" ? it.value.toLocaleString("he-IL") : "—"}
                        </div>
                      </button>
                    );
                  }

                  return (
                    <div key={it.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                      <div className="text-xs font-medium text-zinc-500">{it.label}</div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-900">
                        {typeof it.value === "number" ? it.value.toLocaleString("he-IL") : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="text-sm font-semibold">מחיקת בקשות ישנות</div>
                <div className="mt-1 text-sm text-zinc-600">ברירת מחדל מוחקת רק בקשות סגורות/מבוטלות/נדחות/מאושרות.</div>

                {purgeError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {purgeError}
                  </div>
                ) : null}
                {purgeOk ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    {purgeOk}
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-zinc-500">מחק בקשות ישנות מ־(ימים)</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                      inputMode="numeric"
                      value={String(purgeDays)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPurgeDays(Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 30);
                      }}
                    />
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
                    <span>כולל בקשות ממתינות</span>
                    <input
                      type="checkbox"
                      checked={purgeIncludePending}
                      onChange={(e) => setPurgeIncludePending(e.target.checked)}
                    />
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    disabled={purgeLoading || loading}
                    onClick={() => void purgeOldRequests()}
                  >
                    {purgeLoading ? "מוחק..." : "מחק בקשות"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-100 bg-white p-4">
                <div className="text-sm font-semibold">משתמשים</div>

                {usersError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {usersError}
                  </div>
                ) : null}

                <div className="mt-3">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    placeholder="חיפוש לפי מייל / טלפון / UID"
                    value={usersQuery}
                    onChange={(e) => {
                      setUsersQuery(e.target.value);
                    }}
                  />
                </div>

                <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-zinc-100">
                  {usersLoading ? (
                    <div className="p-3 text-sm text-zinc-600">טוען...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-3 text-sm text-zinc-600">
                      {usersQuery.trim()
                        ? "אין תוצאות לחיפוש"
                        : "אין משתמשים להצגה (אם זה לא הגיוני, לחץ רענן)"}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.uid}
                          type="button"
                          className={`w-full p-3 text-right hover:bg-zinc-50 ${
                            selectedUid === u.uid ? "bg-zinc-50" : ""
                          }`}
                          onClick={() => {
                            setSelectedUid(u.uid);
                            void loadUserDetails(u.uid);
                          }}
                        >
                          <div className="text-sm font-medium text-zinc-900">
                            {u.email || u.uid}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-600">{u.phone || ""}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-white p-4">
                <div className="text-sm font-semibold">פרטי משתמש</div>

                {!selectedUid ? (
                  <div className="mt-3 text-sm text-zinc-600">בחר משתמש מהרשימה</div>
                ) : detailsLoading ? (
                  <div className="mt-3 text-sm text-zinc-600">טוען...</div>
                ) : detailsError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {detailsError}
                  </div>
                ) : details ? (
                  <div className="mt-3">
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                      <div className="text-xs font-medium text-zinc-500">עריכת משתמש</div>

                      {saveError ? (
                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                          {saveError}
                        </div>
                      ) : null}
                      {saveOk ? (
                        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
                          {saveOk}
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <label className="text-xs text-zinc-500">מייל</label>
                        <input
                          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-zinc-500">טלפון</label>
                        <input
                          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-zinc-500">שם תצוגה</label>
                        <input
                          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
                          <span>התראות פוש</span>
                          <input
                            type="checkbox"
                            checked={editPrefPush}
                            onChange={(e) => setEditPrefPush(e.target.checked)}
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
                          <span>התראות במייל</span>
                          <input
                            type="checkbox"
                            checked={editPrefEmail}
                            onChange={(e) => setEditPrefEmail(e.target.checked)}
                          />
                        </label>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs text-zinc-500">UID</div>
                          <div className="break-all text-xs font-mono text-zinc-800">{details.user.uid}</div>
                        </div>
                        <button
                          type="button"
                          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                          disabled={saveLoading || detailsLoading}
                          onClick={() => void saveUserEdits()}
                        >
                          שמור
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-zinc-100 bg-white p-3">
                        <div className="text-xs text-zinc-500">עמדות</div>
                        <div className="mt-1 text-lg font-semibold">
                          {details.counts.stations.toLocaleString("he-IL")}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-100 bg-white p-3">
                        <div className="text-xs text-zinc-500">בקשות כבעלים</div>
                        <div className="mt-1 text-lg font-semibold">
                          {details.counts.requestsAsOwner.toLocaleString("he-IL")}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-100 bg-white p-3">
                        <div className="text-xs text-zinc-500">בקשות כנהג</div>
                        <div className="mt-1 text-lg font-semibold">
                          {details.counts.requestsAsDriver.toLocaleString("he-IL")}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-semibold">עמדות</div>
                      <div className="mt-2 space-y-2">
                        {details.stations.length === 0 ? (
                          <div className="text-sm text-zinc-600">אין עמדות</div>
                        ) : (
                          details.stations.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-xl border border-zinc-100 bg-white p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{s.title || s.id}</div>
                                  <div className="mt-0.5 text-xs text-zinc-600">
                                    {[s.city, s.address].filter(Boolean).join(" • ")}
                                  </div>
                                </div>
                                <a
                                  className="text-sm font-medium text-zinc-900 hover:underline"
                                  href={`/stations/${encodeURIComponent(s.id)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  פתח
                                </a>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
