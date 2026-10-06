import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "manual-article-media";
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export async function POST(request: NextRequest) {
  const { token, filename, contentType } = await request.json().catch(() => ({}));
  if (!token || !filename || !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "media upload is not configured" }, { status: 503 });
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authorized } = await (anon.rpc as any)("admin_check", { p_token: token });
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const extension = String(filename).split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    (contentType.startsWith("video/") ? "mp4" : "jpg");
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "could not create upload" }, { status: 500 });
  }

  const { data: publicData } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicData.publicUrl,
  });
}
