"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";

import { getIdToken } from "firebase/auth";

import { getClientAuth } from "@/lib/firebaseClient";

export default function ApproveStationPage() {
  const params = useParams<{ stationId: string }>();
  const searchParams = useSearchParams();

  const stationId = useMemo(() => String(params?.stationId ?? "").trim(), [params]);
  const requestId = useMemo(() => String(searchParams?.get("requestId") ?? "").trim(), [searchParams]);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [step, setStep] = useState<"initial" | "payment">("initial");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  function showPaymentOption() {
    setError(null);
    setStep("payment");
  }

  async function patchStatus(nextStatus: "approved" | "rejected", opts?: { ownerPaidFee?: boolean }) {
    try {
      setError(null);
      if (!requestId) {
        setError("חסר requestId בקישור");
        return;
      }
      if (!user) {
        setError("נדרשת התחברות כדי לאשר/לדחות בקשה");
        return;
      }

      setSaving(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/interest-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, status: nextStatus, ...(opts ?? {}) }),
      });

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "שגיאה בעדכון הבקשה");
      }

      if (nextStatus === "approved") {
        alert("האישור נשלח ללקוח.");
      } else {
        alert("הודעה נשלחה ללקוח שהעמדה לא פנויה.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }

  async function redirectToCheckout() {
    try {
      setError(null);
      if (!stationId || !requestId) {
        setError("חסר מזהה עמדה או requestId בקישור");
        return;
      }
      if (!user) {
        setError("נדרשת התחברות כדי לבצע תשלום");
        return;
      }

      setSaving(true);

      await patchStatus("approved", { ownerPaidFee: true });

      const token = await getIdToken(user);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stationId }),
      });

      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה ביצירת תשלום");
      if (!json.url) throw new Error("לא התקבל קישור לתשלום");

      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }

  function finishProcess() {
    setError(null);
    alert("האישור נשלח ללקוח. הלקוח ישלם את העמלה.");
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <div />
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה
          </a>
        </div>

        <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <div className="text-lg font-semibold text-zinc-800">בקשת טעינה חדשה</div>
          <div className="mt-2 text-sm text-zinc-700">האם העמדה פנויה?</div>

          {authReady && !user ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              כדי לאשר/לדחות בקשה צריך להתחבר לחשבון של בעל העמדה.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-around gap-3">
            <button
              type="button"
              className="rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700"
              onClick={showPaymentOption}
              disabled={!stationId || !requestId || saving}
            >
              אישור
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700"
              onClick={() => void patchStatus("rejected")}
              disabled={!stationId || !requestId || saving}
            >
              לא פנוי
            </button>
          </div>

          {step === "payment" ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="text-sm text-zinc-700">
                באפשרותך לשלם את העמלה במקום הלקוח (1 ש"ח). תרצה לעשות זאת?
              </div>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => void redirectToCheckout()}
                  disabled={saving}
                >
                  כן
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-zinc-500 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-600"
                  onClick={() => {
                    void patchStatus("approved").then(() => finishProcess());
                  }}
                  disabled={saving}
                >
                  לא
                </button>
              </div>

              <div className="mt-3 text-xs text-zinc-500">קופון שיוזן כרגע: עם ישראל</div>
            </div>
          ) : null}

          {!stationId || !requestId ? (
            <div className="mt-4 text-sm text-red-700">חסר מזהה עמדה או requestId בקישור</div>
          ) : (
            <div className="mt-4 text-xs text-zinc-500">מזהה עמדה: {stationId}</div>
          )}
        </div>
      </main>
    </div>
  );
}
