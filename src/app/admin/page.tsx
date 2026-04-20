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

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

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
      { label: "משתמשים", value: stats.users },
      { label: "בקשות", value: stats.interestRequests },
      { label: "בקשות שאושרו", value: stats.approvedRequests },
      { label: "בקשות שנסגרו", value: stats.closedRequests },
      { label: "עברו את כל התהליך", value: stats.completedProcess },
      { label: "נחשפו עם קופון", value: stats.couponReveals },
      { label: "שילמו (לידים)", value: stats.paidLeads ?? 0 },
      { label: "שילמו (סה\"כ)", value: stats.paid },
    ];
  }, [stats]);

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
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => void refresh()}
            >
              רענן
            </button>
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

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">{it.label}</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900">
                  {typeof it.value === "number" ? it.value.toLocaleString("he-IL") : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
