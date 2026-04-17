import { NextResponse } from "next/server";

import { ADMIN_EMAILS } from "@/lib/admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as null | { stationId?: string };
    const stationId = body?.stationId;
    if (!stationId) {
      return NextResponse.json({ error: "Missing stationId" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);

    const email = (decoded.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await adminDb.collection("stations").doc(stationId).delete();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
