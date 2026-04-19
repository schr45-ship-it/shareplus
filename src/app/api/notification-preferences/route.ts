import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type NotificationPreferences = {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
};

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const adminDb = getAdminDb();
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    const data = snap.exists ? (snap.data() as { notificationPreferences?: NotificationPreferences }) : null;

    return NextResponse.json({
      preferences: {
        pushEnabled: data?.notificationPreferences?.pushEnabled ?? true,
        emailEnabled: data?.notificationPreferences?.emailEnabled ?? true,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as null | {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
    };

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const update: NotificationPreferences = {};
    if (typeof body?.pushEnabled === "boolean") update.pushEnabled = body.pushEnabled;
    if (typeof body?.emailEnabled === "boolean") update.emailEnabled = body.emailEnabled;

    const adminDb = getAdminDb();
    await adminDb
      .collection("users")
      .doc(decoded.uid)
      .set(
        {
          notificationPreferences: update,
          updatedAt: new Date(),
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
