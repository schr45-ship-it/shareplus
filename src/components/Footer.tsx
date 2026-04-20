"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false);
  const whatsappUrl = useMemo(() => {
    const phoneE164Digits = "972527710258";
    return `https://wa.me/${phoneE164Digits}`;
  }, []);

  return (
    <footer className="mt-auto border-t border-zinc-100 bg-white" dir="rtl">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="text-xs text-zinc-500">© {new Date().getFullYear()} SharePlus</div>
        <nav className="flex items-center gap-4 text-xs">
          <Link className="text-zinc-600 hover:underline" href="/about">
            אודות
          </Link>
          <button
            type="button"
            className="text-zinc-600 hover:underline"
            onClick={() => setContactOpen(true)}
          >
            צור קשר
          </button>
          <Link className="text-zinc-600 hover:underline" href="/terms">
            תנאי שימוש
          </Link>
          <Link className="text-zinc-600 hover:underline" href="/accessibility">
            הצהרת נגישות
          </Link>
        </nav>
      </div>

      {contactOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          dir="rtl"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setContactOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-right shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="text-base font-semibold">צור קשר</div>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                onClick={() => setContactOpen(false)}
              >
                סגור
              </button>
            </div>

            <div className="mt-3 text-sm text-zinc-700">
              נבנה על ידי מול ההר יזמות, ליצירת קשר{" "}
              <a
                className="font-semibold text-zinc-900 underline"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
              >
                לחץ כאן
              </a>
            </div>

            <div className="mt-4">
              <a
                className="block w-full rounded-xl bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-green-700"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
              >
                שלח הודעה ב-WhatsApp
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
