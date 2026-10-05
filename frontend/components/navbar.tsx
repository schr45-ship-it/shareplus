"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./locale-switcher";

export function Navbar() {
  const t = useTranslations("nav");

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
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
          </Link>
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
          <Link
            href="/search"
            className="whitespace-nowrap text-sm font-medium hover:underline"
          >
            {t("search")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
