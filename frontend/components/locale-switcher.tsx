"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { locales, Locale } from "@/i18n/routing";

const labels: Record<Locale, { name: string; short: string }> = {
  en: { name: "English", short: "EN" },
  he: { name: "עברית", short: "עב" },
  es: { name: "Español", short: "ES" },
  ar: { name: "العربية", short: "عر" },
};

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const currentLocale = (params?.locale as Locale) ?? "en";

  function handleChange(locale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: locale as Locale });
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1"
    >
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleChange(locale)}
          disabled={isPending}
          title={labels[locale].name}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
            locale === currentLocale
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          {labels[locale].short}
        </button>
      ))}
    </div>
  );
}
