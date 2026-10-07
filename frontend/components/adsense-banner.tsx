"use client";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export function AdSenseScript() {
  if (!ADSENSE_CLIENT_ID) return null;

  // Plain <script> so it appears in the initial HTML — AdSense verification
  // crawlers check the raw page source, not the hydrated DOM.
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}

export function AdSenseBanner({
  slot,
  layout = "responsive",
  format = "auto",
  className = "",
}: {
  slot: string;
  layout?: "in-article" | "in-feed" | "display" | "responsive";
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
  className?: string;
}) {
  if (!ADSENSE_CLIENT_ID || !slot) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-400 ${className}`}
      >
        Ad placeholder
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
      data-ad-layout={layout}
    />
  );
}

export function AdSenseInArticle({
  slot,
  className = "my-8",
}: {
  slot: string;
  className?: string;
}) {
  if (!ADSENSE_CLIENT_ID || !slot) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-400 ${className}`}
      >
        In-article ad placeholder
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block", textAlign: "center" }}
      data-ad-layout="in-article"
      data-ad-format="fluid"
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
    />
  );
}
