export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.shareplusai.com"
).replace(/\/$/, "");

// Route storage-hosted article images through the repair proxy so objects that
// were saved as JSON-serialized buffers still render correctly.
export function articleImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/article-images\/([a-zA-Z0-9-]+\.jpg)/);
  return m ? `/api/img/${m[1]}` : url;
}
