"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

const text: Record<string, { msg: string; accept: string; learn: string }> = {
  en: {
    msg: "This site uses cookies to improve your browsing experience and analyze traffic.",
    accept: "Got it",
    learn: "Learn more",
  },
  he: {
    msg: "אתר זה עושה שימוש בעוגיות כדי לשפר את חווית הגלישה ולנתח תנועה.",
    accept: "הבנתי",
    learn: "מידע נוסף",
  },
  es: {
    msg: "Este sitio usa cookies para mejorar tu experiencia de navegación y analizar el tráfico.",
    accept: "Entendido",
    learn: "Más info",
  },
  ar: {
    msg: "يستخدم هذا الموقع ملفات تعريف الارتباط لتحسين تجربة التصفح وتحليل حركة المرور.",
    accept: "فهمت",
    learn: "مزيد من المعلومات",
  },
};

const KEY = "shareplus-cookie-consent";

export function CookieBanner({ locale }: { locale: string }) {
  const [show, setShow] = useState(false);
  const t = text[locale] ?? text.en;

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-sm text-zinc-600 sm:text-start">
          🍪 {t.msg}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={"/privacy" as any}
            className="text-sm text-blue-600 hover:underline"
            onClick={() => {
              try { localStorage.setItem(KEY, "1"); } catch {}
              setShow(false);
            }}
          >
            {t.learn}
          </Link>
          <button
            onClick={() => {
              try { localStorage.setItem(KEY, "1"); } catch {}
              setShow(false);
            }}
            className="rounded-full bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
