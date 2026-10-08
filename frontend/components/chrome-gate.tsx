"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

const CLEAN_PATHS = ["/havruta", "/teacher", "/shadchan"];

export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (CLEAN_PATHS.some((p) => pathname.includes(p))) return null;
  return <>{children}</>;
}
