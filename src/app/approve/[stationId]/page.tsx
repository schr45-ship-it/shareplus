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

  const [step, setStep] = useState<"initial" | "coupon">("initial");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [coupon, setCoupon] = useState("");
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [whatsappDigits, setWhatsappDigits] = useState<string | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  async function patchStatus(nextStatus: "approved" | "rejected", opts?: { ownerPaidFee?: boolean }) {
    try {
      setError(null);
      if (!requestId) {
        setError("חסר requestId בקישור");
        return false;
      }
      if (!user) {
        setError("נדרשת התחברות כדי לאשר/לדחות בקשה");
        return false;
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

      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function revealDriverPhone() {
    try {
      setError(null);
      if (!requestId) {
        setError("חסר requestId בקישור");
        return;
      }
      if (!user) {
        setError("נדרשת התחברות כדי לצפות בפרטי הלקוח");
        return;
      }

      setSaving(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/interest-requests/reveal-driver-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, coupon }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        phone?: string;
        whatsappDigits?: string;
      };

      if (!res.ok) throw new Error(json.error ?? "שגיאה בחשיפת פרטי הלקוח");
      setDriverPhone(String(json.phone ?? ""));
      setWhatsappDigits(String(json.whatsappDigits ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
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
              onClick={() => {
                setDriverPhone(null);
                setWhatsappDigits(null);
                void patchStatus("approved").then((ok) => {
                  if (ok) setStep("coupon");
                });
              }}
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

          {step === "coupon" ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="text-sm text-zinc-700">
                כדי לקבל את טלפון הלקוח, הזן קופון: <span className="font-semibold">עם ישראל</span>
              </div>

              <div className="mt-4">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                  placeholder="הכנס קופון"
                  disabled={saving}
                />
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  onClick={() => void revealDriverPhone()}
                  disabled={saving || !coupon.trim()}
                >
                  קבל טלפון
                </button>
              </div>

              {driverPhone ? (
                <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-3 text-right text-sm text-zinc-800">
                  <div className="font-medium">מספר הטלפון של הלקוח הוא: {driverPhone}</div>
                  {whatsappDigits ? (
                    <a
                      className="mt-2 inline-block font-semibold text-zinc-900 underline"
                      href={`https://wa.me/${whatsappDigits.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      לחץ כאן לשלוח WhatsApp
                    </a>
                  ) : null}
                </div>
              ) : null}
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
