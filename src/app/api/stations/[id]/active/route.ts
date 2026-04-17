import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/admin";

export async function POST(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const rawParams = (ctx as { params: unknown }).params;
    const params = rawParams instanceof Promise ? await rawParams : (rawParams as { id: string });
    const stationId = params.id;
    if (!stationId) {
      return NextResponse.json({ error: "Missing station id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as null | { isActive?: unknown };
    const isActive = body?.isActive;
    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);

    const ref = adminDb.collection("stations").doc(stationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const data = snap.data() as { ownerUid?: string };

    const email = (decoded.email ?? "").toLowerCase();
    const isAdmin = isAdminEmail(email);
    const isOwner = Boolean(data.ownerUid) && data.ownerUid === decoded.uid;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ref.update({ isActive, updatedAt: new Date() });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
