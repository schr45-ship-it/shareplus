import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const dbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const MAX_TEXT = 4000;
const CATEGORIES = ["hosting", "domain", "database", "ads", "email", "social", "tools", "payment", "other"];

async function authorized(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_check`, {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({ p_token: token }),
    });
    return res.ok && (await res.json()) === true;
  } catch {
    return false;
  }
}

function clean(v: unknown, max = MAX_TEXT): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_vault?select=*&order=category.asc,sort_order.asc,name.asc`,
      { headers: dbHeaders, cache: "no-store" },
    );
    const rows = await res.json();
    return NextResponse.json({ entries: Array.isArray(rows) ? rows : [] });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const name = clean(body.name, 200);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "other";

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_vault`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        name,
        url: clean(body.url, 500),
        category,
        username: clean(body.username, 300),
        secret: clean(body.secret),
        notes: clean(body.notes),
      }),
    });
    const rows = await res.json();
    if (!res.ok) return NextResponse.json({ error: "insert failed" }, { status: 500 });
    return NextResponse.json({ entry: rows?.[0] ?? null });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "url", "username", "secret", "notes"] as const) {
    if (k in body) updates[k] = clean(body[k], k === "name" ? 200 : k === "url" ? 500 : MAX_TEXT);
  }
  if ("category" in body) {
    updates.category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "other";
  }
  if ("sort_order" in body && Number.isFinite(Number(body.sort_order))) {
    updates.sort_order = Number(body.sort_order);
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_vault?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...dbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return NextResponse.json({ error: "update failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_vault?id=eq.${id}`, {
      method: "DELETE",
      headers: dbHeaders,
    });
    if (!res.ok) return NextResponse.json({ error: "delete failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
