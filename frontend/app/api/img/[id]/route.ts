import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
  /\/$/,
  "",
);

// Some objects in the article-images bucket were accidentally uploaded as
// JSON-serialized buffers ({"type":"Buffer","data":[...]}). This route serves
// the decoded JPEG bytes so those images render correctly.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const safeId = id.replace(/\.jpg$/, "").replace(/[^a-zA-Z0-9-]/g, "");

  const r = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/article-images/${safeId}.jpg`,
  );
  if (!r.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const buf = Buffer.from(await r.arrayBuffer());

  if (buf.length > 2 && buf[0] === 0x7b /* { */) {
    try {
      const parsed = JSON.parse(buf.toString("utf8"));
      if (parsed?.type === "Buffer" && Array.isArray(parsed.data)) {
        return new NextResponse(Buffer.from(parsed.data), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      }
    } catch {
      // fall through to pass-through
    }
  }

  return new NextResponse(buf, {
    headers: {
      "Content-Type": r.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
