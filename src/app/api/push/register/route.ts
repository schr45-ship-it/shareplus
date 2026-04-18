import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as null | {
      token?: string;
    };

    const pushToken = (body?.token ?? "").trim();
    if (!pushToken) {
      return NextResponse.json({ error: "Missing push token" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const adminDb = getAdminDb();
    const ref = adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("pushTokens")
      .doc(pushToken);

    await ref.set(
      {
        token: pushToken,
        platform: "web",
        browser: "chrome",
        updatedAt: new Date(),
        createdAt: new Date(),
        userAgent: req.headers.get("user-agent") ?? null,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
