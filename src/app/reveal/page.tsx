"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { getClientAuth } from "@/lib/firebaseClient";
import { getIdToken } from "@/lib/auth";

type RevealData = {
  title: string;
  stationId: string;
  exactAddress: string;
  expiresAt: string;
  contact: {
    phone: string;
    name: string;
    whatsappUrl?: string;
  };
};

export default function RevealPage() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<RevealData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("session_id");
  }, []);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (!sessionId) throw new Error("Missing session_id");
        if (!user) throw new Error("נדרשת התחברות כדי להשלים חשיפה");

        const token = await getIdToken(user);
        const res = await fetch("/api/reveal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        const json = (await res.json().catch(() => ({}))) as RevealData & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Reveal failed");

        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user]);

  return (
    <div className="min-h-dvh bg-white" dir="rtl">
      <main className="mx-auto w-full max-w-xl px-6 py-10">
        <h1 className="text-xl font-semibold">חשיפת פרטים</h1>

        {loading ? (
          <div className="mt-4 text-sm text-zinc-600">טוען...</div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : data ? (
          <div className="mt-6 rounded-2xl border border-zinc-100 p-5">
            <div className="text-sm font-semibold">{data.title}</div>
            <div className="mt-2 text-sm text-zinc-700">רחוב: {data.exactAddress}</div>
            <div className="mt-2 text-sm text-zinc-700">
              טלפון מארח: {data.contact.phone} {data.contact.name ? `(${data.contact.name})` : ""}
            </div>
            <div className="mt-4 flex gap-3">
              <a
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                href={`tel:${data.contact.phone}`}
              >
                התקשר
              </a>
              <a
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                href={
                  data.contact.whatsappUrl ||
                  `https://wa.me/${data.contact.phone.replace(/[^0-9]/g, "")}`
                }
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <a
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                href={`https://waze.com/ul?q=${encodeURIComponent(data.exactAddress)}&navigate=yes`}
                target="_blank"
                rel="noreferrer"
              >
                ניווט ב-Waze
              </a>
            </div>
            <div className="mt-4 text-xs text-zinc-500">הגישה בתוקף עד: {data.expiresAt}</div>
          </div>
        ) : null}

        <div className="mt-8">
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה לחיפוש
          </a>
        </div>
      </main>
    </div>
  );
}
