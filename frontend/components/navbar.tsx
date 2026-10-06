"use client";

import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { LocaleSwitcher } from "./locale-switcher";
import { SITE_URL } from "@/lib/site";

export function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/search?q=${encodeURIComponent(value)}` as any);
    setSearchOpen(false);
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <a
            href={`${SITE_URL}/${locale}`}
            className="flex items-center gap-2.5 hover:opacity-80"
          >
            <img
              src="/logo.jpg"
              alt="SharePlus"
              className="h-9 w-9 rounded-lg object-cover mix-blend-multiply sm:h-10 sm:w-10"
            />
            <span className="text-lg font-bold text-foreground sm:text-xl">
              SharePlus
            </span>
          </a>
          <LocaleSwitcher />
        </div>
        <nav className="mt-2 flex items-center gap-4 overflow-x-auto pb-1 sm:gap-5">
          <Link
            href="/"
            className="whitespace-nowrap text-sm font-medium hover:underline"
          >
            {t("home")}
          </Link>
          <Link
            href="/gallery"
            className="whitespace-nowrap text-sm font-medium hover:underline"
          >
            {t("gallery")}
          </Link>
          <Link
            href="/about"
            className="whitespace-nowrap text-sm font-medium hover:underline"
          >
            {t("about")}
          </Link>
          <Link
            href="/contact"
            className="whitespace-nowrap text-sm font-medium hover:underline"
          >
            {t("contact")}
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="whitespace-nowrap text-sm font-medium hover:underline"
            aria-expanded={searchOpen}
            aria-controls="header-search"
          >
            {t("search")}
          </button>
        </nav>

        {searchOpen && (
          <form
            id="header-search"
            onSubmit={submitSearch}
            className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 shadow-sm"
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              {t("search")}
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
              aria-label="Close search"
            >
              ×
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
