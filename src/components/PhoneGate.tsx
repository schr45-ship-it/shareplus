"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { getClientAuth } from "@/lib/firebaseClient";
import { getClientDb } from "@/lib/firestoreClient";
import { isValidPhone } from "@/lib/phone";

type ProfileDoc = {
  phone?: string;
};

export default function PhoneGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPhone, setNeedsPhone] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);

        if (typeof window !== "undefined") {
          const path = window.location.pathname || "/";
          if (path.startsWith("/profile")) {
            setNeedsPhone(false);
            return;
          }
        }

        if (!user) {
          setNeedsPhone(false);
          return;
        }

        const db = getClientDb();
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as ProfileDoc) : null;
        const phone = String(data?.phone ?? "");

        if (!cancelled) {
          setNeedsPhone(!isValidPhone(phone));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !needsPhone) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-right shadow-xl">
        <div className="text-base font-semibold">נדרש מספר טלפון</div>
        <div className="mt-1 text-sm text-zinc-600">
          כדי להמשיך להשתמש בשירות, צריך להכניס מספר טלפון בהגדרות הפרופיל.
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Link
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            href="/profile"
          >
            עבור להגדרות
          </Link>
        </div>
      </div>
    </div>
  );
}
