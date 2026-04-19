import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";

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
    const tokensSnap = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("pushTokens")
      .get();

    const tokens = tokensSnap.docs
      .map((d) => (d.data() as { token?: string }).token)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

    if (tokens.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "לא נמצא טוקן להתראות. לחץ על 'רענן רישום התראות' בפרופיל ואז נסה שוב.",
          tokenCount: 0,
        },
        { status: 404 }
      );
    }

    const messaging = getAdminMessaging();
    const title = "SharePlus – בדיקת התראה";
    const body = "אם אתה רואה את זה, התראות פוש עובדות במכשיר הזה.";

    const result = await messaging.sendEachForMulticast({
      tokens,
      data: {
        type: "PUSH_TEST",
        title,
        body,
        deepLink: "/profile",
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/logo.jpg",
        },
        fcmOptions: {
          link: "/profile",
        },
      },
    });

    const failures = result.responses
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !r.success)
      .map(({ r, idx }) => ({
        token: tokens[idx],
        error: r.error?.message ?? "Unknown error",
      }));

    return NextResponse.json({
      ok: true,
      tokenCount: tokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      failures,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
