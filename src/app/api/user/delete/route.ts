import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const adminDb = getAdminDb();

    // Best-effort cleanup of push tokens
    const pushTokensSnap = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("pushTokens")
      .get();

    const batch = adminDb.batch();
    for (const d of pushTokensSnap.docs) {
      batch.delete(d.ref);
    }
    // Keep user doc delete as part of the batch
    batch.delete(adminDb.collection("users").doc(decoded.uid));
    await batch.commit();

    await adminAuth.deleteUser(decoded.uid);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
