"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./locale-switcher";

export function Navbar() {
  const t = useTranslations("nav");

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="text-xl font-bold text-foreground hover:opacity-80"
        >
          AI SharePlus
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:underline">
            {t("home")}
          </Link>
          <Link href="/search" className="text-sm font-medium hover:underline">
            {t("search")}
          </Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
