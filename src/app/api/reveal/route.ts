import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);

    const body = (await req.json().catch(() => null)) as null | {
      sessionId?: string;
    };
    const sessionId = body?.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }

    const stationId = session.metadata?.stationId;
    const sessionUid = session.metadata?.uid;

    if (!stationId || !sessionUid) {
      return NextResponse.json({ error: "Missing metadata in session" }, { status: 500 });
    }

    if (sessionUid !== decoded.uid) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const now = Date.now();
    const expiresAt = new Date(now + WEEK_MS);

    const purchaseId = `${decoded.uid}_${stationId}`;

    await adminDb.collection("revealPurchases").doc(purchaseId).set(
      {
        uid: decoded.uid,
        stationId,
        stripeSessionId: session.id,
        expiresAt,
        updatedAt: new Date(now),
        createdAt: new Date(now),
      },
      { merge: true }
    );

    const stationDoc = await adminDb.collection("stations").doc(stationId).get();
    if (!stationDoc.exists) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const station = stationDoc.data() as {
      exactAddress?: string;
      hostPhone?: string;
      hostName?: string;
      title?: string;
    };

    return NextResponse.json({
      stationId,
      expiresAt: expiresAt.toISOString(),
      contact: {
        phone: station.hostPhone ?? "",
        name: station.hostName ?? "",
      },
      exactAddress: station.exactAddress ?? "",
      title: station.title ?? "עמדה",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
