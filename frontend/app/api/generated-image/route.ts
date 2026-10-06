import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["image.pollinations.ai"]);

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");
  if (!source) return new NextResponse("Missing image URL", { status: 400 });

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse("Image host is not allowed", { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/jpeg,image/*" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok || !response.body) {
      return NextResponse.redirect(
        new URL(`/api/og?title=${encodeURIComponent("SharePlus")}`, request.url),
      );
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.redirect(
      new URL(`/api/og?title=${encodeURIComponent("SharePlus")}`, request.url),
    );
  }
}
