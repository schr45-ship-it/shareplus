export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.shareplusai.com"
).replace(/\/$/, "");

// Route storage-hosted article images through the repair proxy so objects that
// were saved as JSON-serialized buffers still render correctly.
// Fallback Hebrew/English names for categories whose localized name is
// corrupted in the DB (mojibake like "????" from a bad insert).
const SLUG_NAMES: Record<string, Record<string, string>> = {
  media: { he: "מדיה", en: "Media", es: "Medios", ar: "وسائط" },
  technology: { he: "טכנולוגיה", en: "Technology" },
  business: { he: "עסקים", en: "Business" },
  science: { he: "מדע", en: "Science" },
  health: { he: "בריאות", en: "Health" },
  world: { he: "עולם", en: "World" },
  entertainment: { he: "בידור", en: "Entertainment" },
  sports: { he: "ספורט", en: "Sports" },
  politics: { he: "פוליטיקה", en: "Politics" },
  other: { he: "שונות", en: "Other" },
};

function isCorrupted(v: string | null | undefined): boolean {
  return !v || /^[?\uFFFD\s]*$/.test(v) || v.includes("");
}

export function categoryLabel(
  nameJson: Record<string, string> | null | undefined,
  slug: string | null | undefined,
  locale: string,
): string {
  const viaJson = nameJson?.[locale] ?? nameJson?.en;
  if (!isCorrupted(viaJson)) return viaJson!;
  const bySlug = slug ? SLUG_NAMES[slug] : undefined;
  return (
    bySlug?.[locale] ?? bySlug?.en ?? slug ?? ""
  );
}

export function articleImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/article-images\/([a-zA-Z0-9-]+\.jpg)/);
  if (m) return `/api/img/${m[1]}`;
  if (url.startsWith("https://image.pollinations.ai/")) {
    return `/api/generated-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function articleThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("https://image.pollinations.ai/")) {
    const thumbnail = new URL(url);
    thumbnail.searchParams.set("width", "480");
    thumbnail.searchParams.set("height", "270");
    return `/api/generated-image?url=${encodeURIComponent(thumbnail.toString())}`;
  }
  return articleImageUrl(url);
}
