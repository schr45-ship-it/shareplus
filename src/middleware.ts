import { NextResponse } from "next/server";

export function middleware(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.pathname !== "/") return NextResponse.next();

    const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
    const isSocialScraper =
      ua.includes("facebookexternalhit") ||
      ua.includes("facebot") ||
      ua.includes("whatsapp") ||
      ua.includes("twitterbot") ||
      ua.includes("linkedinbot") ||
      ua.includes("slackbot") ||
      ua.includes("discordbot") ||
      ua.includes("telegrambot");

    if (!isSocialScraper) return NextResponse.next();

    const html = `<!doctype html>
<html lang="he">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SharePlus</title>
    <meta name="description" content="רשת טעינה שיתופית לקהילת ה-EV" />

    <meta property="og:title" content="SharePlus" />
    <meta property="og:description" content="רשת טעינה שיתופית לקהילת ה-EV" />
    <meta property="og:url" content="https://car.clap.co.il/" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://car.clap.co.il/og.jpg?v=4" />
    <meta property="og:image:secure_url" content="https://car.clap.co.il/og.jpg?v=4" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1424" />
    <meta property="og:image:height" content="752" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="SharePlus" />
    <meta name="twitter:description" content="רשת טעינה שיתופית לקהילת ה-EV" />
    <meta name="twitter:image" content="https://car.clap.co.il/og.jpg?v=4" />
  </head>
  <body></body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/"],
};
