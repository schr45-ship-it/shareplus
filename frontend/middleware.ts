import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  // Canonical domain: redirect apex → www (301 for SEO consolidation)
  const host = req.headers.get("host") ?? "";
  if (host === "shareplusai.com") {
    const url = req.nextUrl.clone();
    url.host = "www.shareplusai.com";
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }
  return intl(req);
}

export const config = {
  // Match all pathnames except for
  // - /api routes
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - Static files (e.g. /favicon.ico)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
