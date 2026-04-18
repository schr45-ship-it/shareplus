"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { getClientAuth } from "@/lib/firebaseClient";
import { getClientDb } from "@/lib/firestoreClient";

const TERMS_VERSION = "2026-04-18";
const TERMS_WINDOW_FLAG = "__shareplusTermsPrompt";

export default function TermsGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAccept, setNeedsAccept] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptEnabled, setPromptEnabled] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const current = Boolean((window as unknown as Record<string, unknown>)[TERMS_WINDOW_FLAG]);
    setPromptEnabled(current);

    const handler = () => setPromptEnabled(true);

    window.addEventListener("shareplus:terms-prompt", handler);
    return () => window.removeEventListener("shareplus:terms-prompt", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (!promptEnabled) {
          setNeedsAccept(false);
          setAccepted(false);
          return;
        }

        if (!user) {
          setNeedsAccept(false);
          setAccepted(false);
          return;
        }

        const db = getClientDb();
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as { acceptedTermsVersion?: string }) : null;
        const already = data?.acceptedTermsVersion === TERMS_VERSION;

        if (!cancelled) {
          setNeedsAccept(!already);
          setAccepted(false);
        }

        if (already && typeof window !== "undefined") {
          (window as unknown as Record<string, unknown>)[TERMS_WINDOW_FLAG] = false;
          setPromptEnabled(false);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [promptEnabled, user]);

  const accept = useCallback(async () => {
    try {
      setError(null);
      if (!user) return;
      if (!accepted) {
        setError("כדי להמשיך, יש לאשר את תנאי השימוש");
        return;
      }

      setSaving(true);
      const db = getClientDb();
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          acceptedTermsVersion: TERMS_VERSION,
          acceptedTermsAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
      setNeedsAccept(false);
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>)[TERMS_WINDOW_FLAG] = false;
        setPromptEnabled(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }, [accepted, user]);

  if (loading || !promptEnabled || !needsAccept) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-right shadow-xl">
        <div className="text-base font-semibold">אישור תנאי שימוש</div>
        <div className="mt-1 text-sm text-zinc-600">
          כדי להשתמש בשירות לאחר ההרשמה, יש לאשר את תנאי השימוש. תנאי השימוש עשויים להתעדכן מעת לעת.
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">
          <div>
            גרסה: <span className="font-semibold">{TERMS_VERSION}</span>
          </div>
          <div className="mt-2">
            <Link className="font-medium text-zinc-900 hover:underline" href="/terms" target="_blank">
              קרא את תנאי השימוש
            </Link>
          </div>
        </div>

        <label className="mt-4 flex items-center justify-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>אני מאשר/ת את תנאי השימוש</span>
        </label>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            onClick={() => void accept()}
          >
            {saving ? "שומר..." : "אשר והמשך"}
          </button>
        </div>
      </div>
    </div>
  );
}
