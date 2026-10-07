"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LocaleNotFound() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "he";

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/${locale}`);
    }, 3500);
    return () => clearTimeout(timer);
  }, [router, locale]);

  return (
    <main dir="rtl" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-3 text-2xl font-bold text-zinc-900">דף זה הוסר</h1>
      <p className="mb-6 text-zinc-500">
        הכתבה אינה זמינה יותר. בעוד רגע תועבר לדף הבית.
      </p>
      <button
        onClick={() => router.push(`/${locale}`)}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        מעבר לדף הבית
      </button>
    </main>
  );
}
