"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { getClientAuth } from "@/lib/firebaseClient";
import { getIdToken } from "@/lib/auth";

type RequestItem = {
  id: string;
  stationId: string;
  stationTitle: string;
  stationCity: string | null;
  stationPriceIls: number | null;
  ownerUid: string;
  driverUid: string;
  otherUid: string;
  otherDisplayName: string | null;
  date: string;
  timeFrom: string;
  timeTo: string;
  status: string;
  finalCostNis: number | null;
  estimatedProfitNis: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatNis(v: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(v);
}

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [closeEditingId, setCloseEditingId] = useState<string | null>(null);
  const [closeFinalCost, setCloseFinalCost] = useState<string>("");
  const [closeProfit, setCloseProfit] = useState<string>("");

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setItems([]);
        return;
      }

      setLoading(true);
      const token = await getIdToken(user);
      const res = await fetch(`/api/interest-requests?scope=${encodeURIComponent(tab)}` as string, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        items?: RequestItem[];
      };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת דוחות");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canManage = tab === "received";
  const canCancel = tab === "sent";

  const updateStatus = useCallback(
    async (
      requestId: string,
      status: "approved" | "rejected" | "closed" | "cancelled",
      opts?: { finalCostNis?: number; estimatedProfitNis?: number }
    ) => {
      try {
        setError(null);
        if (!user) {
          setError("נדרשת התחברות");
          return;
        }
        setSavingId(requestId);
        const token = await getIdToken(user);
        const res = await fetch("/api/interest-requests", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ requestId, status, ...opts }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error ?? "שגיאה בעדכון בקשה");
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      } finally {
        setSavingId(null);
      }
    },
    [reload, user]
  );

  const startCloseEditor = useCallback((item: RequestItem) => {
    setError(null);
    setCloseEditingId(item.id);
    setCloseFinalCost(item.finalCostNis != null ? String(item.finalCostNis) : "");
    setCloseProfit(item.estimatedProfitNis != null ? String(item.estimatedProfitNis) : "");
  }, []);

  const cancelCloseEditor = useCallback(() => {
    setCloseEditingId(null);
    setCloseFinalCost("");
    setCloseProfit("");
  }, []);

  const submitCloseEditor = useCallback(async () => {
    try {
      if (!closeEditingId) return;
      setError(null);

      const finalCostNis = closeFinalCost.trim() === "" ? undefined : Number(closeFinalCost);
      const estimatedProfitNis = closeProfit.trim() === "" ? undefined : Number(closeProfit);

      if (finalCostNis !== undefined && !Number.isFinite(finalCostNis)) {
        setError("ערך לא תקין עבור עלות סופית");
        return;
      }
      if (estimatedProfitNis !== undefined && !Number.isFinite(estimatedProfitNis)) {
        setError("ערך לא תקין עבור רווח משוער");
        return;
      }

      await updateStatus(closeEditingId, "closed", { finalCostNis, estimatedProfitNis });
      cancelCloseEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    }
  }, [cancelCloseEditor, closeEditingId, closeFinalCost, closeProfit, updateStatus]);

  const headline = useMemo(() => (tab === "received" ? "בקשות שהתקבלו" : "בקשות שלי"), [tab]);

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-4xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">דוחות</h1>
            <div className="mt-1 text-sm text-zinc-600">{headline}</div>
          </div>
          <a className="text-sm font-medium text-zinc-700 hover:underline" href="/">
            חזרה
          </a>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === "received" ? "bg-black text-white" : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            }`}
            onClick={() => setTab("received")}
          >
            בקשות שהתקבלו
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === "sent" ? "bg-black text-white" : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            }`}
            onClick={() => setTab("sent")}
          >
            בקשות שלי
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {!user ? (
          <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 text-sm text-zinc-700 shadow-sm">
            נדרשת התחברות כדי לצפות בדוחות.
          </div>
        ) : loading ? (
          <div className="mt-6 text-sm text-zinc-600">טוען...</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 text-sm text-zinc-700 shadow-sm">
            אין נתונים להצגה.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-semibold">{item.stationTitle}</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {item.stationCity ? `${item.stationCity} · ` : ""}
                      {item.date} {item.timeFrom}-{item.timeTo}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {tab === "received" ? "הנהג" : "בעל העמדה"}: {item.otherDisplayName ?? item.otherUid}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div>
                      <span className="font-medium">סטטוס:</span> {item.status}
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">עלות סופית:</span> {formatNis(item.finalCostNis)}
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">רווח משוער:</span> {formatNis(item.estimatedProfitNis)}
                    </div>
                  </div>
                </div>

                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                      onClick={() => updateStatus(item.id, "approved")}
                    >
                      אשר
                    </button>
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                      onClick={() => updateStatus(item.id, "rejected")}
                    >
                      דחה
                    </button>
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                      onClick={() => startCloseEditor(item)}
                    >
                      סגור + סכום
                    </button>
                  </div>
                ) : null}

                {canCancel && item.status !== "closed" && item.status !== "rejected" && item.status !== "cancelled" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                      onClick={() => {
                        if (!window.confirm("האם לבטל את הבקשה?")) return;
                        void updateStatus(item.id, "cancelled");
                      }}
                    >
                      בטל בקשה
                    </button>
                  </div>
                ) : null}

                {canManage && closeEditingId === item.id ? (
                  <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        <div className="font-medium text-zinc-800">כמה עלה בסוף (₪)</div>
                        <input
                          value={closeFinalCost}
                          onChange={(e) => setCloseFinalCost(e.target.value)}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.01}
                          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          placeholder="לדוגמה 35"
                        />
                      </label>
                      <label className="text-sm">
                        <div className="font-medium text-zinc-800">רווח משוער (₪)</div>
                        <input
                          value={closeProfit}
                          onChange={(e) => setCloseProfit(e.target.value)}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.01}
                          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          placeholder="לדוגמה 10"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingId === item.id}
                        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        onClick={() => void submitCloseEditor()}
                      >
                        שמור וסגור
                      </button>
                      <button
                        type="button"
                        disabled={savingId === item.id}
                        className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                        onClick={cancelCloseEditor}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
