"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { locales, Locale } from "@/i18n/routing";

const labels: Record<Locale, string> = {
  en: "English",
  he: "עברית",
  es: "Español",
  ar: "العربية",
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
    <select
      value={currentLocale}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {labels[locale]}
        </option>
      ))}
    </select>
  );
}
