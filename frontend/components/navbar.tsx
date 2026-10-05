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
          className="flex items-center gap-2.5 hover:opacity-80"
        >
          <img
            src="/logo.jpg"
            alt="SharePlus"
            className="h-10 w-10 rounded-lg object-cover mix-blend-multiply"
          />
          <span className="text-xl font-bold text-foreground">SharePlus</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/" className="text-sm font-medium hover:underline">
            {t("home")}
          </Link>
          <Link href="/gallery" className="text-sm font-medium hover:underline">
            {t("gallery")}
          </Link>
          <Link href="/about" className="text-sm font-medium hover:underline">
            {t("about")}
          </Link>
          <Link href="/contact" className="text-sm font-medium hover:underline">
            {t("contact")}
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
