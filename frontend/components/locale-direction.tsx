"use client";

import { ReactNode } from "react";

export function LocaleDirection({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const isRtl = locale === "ar" || locale === "he";
  return (
    <div className={isRtl ? "rtl-layout" : ""}>
      {children}
    </div>
  );
}
