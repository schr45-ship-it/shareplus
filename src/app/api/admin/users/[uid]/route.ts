import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(
  req: Request,
  ctx: { params: { uid: string } } | { params: Promise<{ uid: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const uid = String(resolved.uid ?? "").trim();
    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userDocSnap = await adminDb.collection("users").doc(uid).get();
    const userDoc = userDocSnap.exists
      ? (userDocSnap.data() as {
          phone?: string;
          notificationPreferences?: unknown;
        })
      : null;

    let authEmail = "";
    try {
      const u = await adminAuth.getUser(uid);
      authEmail = (u.email ?? "").trim();
    } catch {
      authEmail = "";
    }

    const stationsSnap = await adminDb
      .collection("stations")
      .where("ownerUid", "==", uid)
      .limit(100)
      .get();

    const stations = stationsSnap.docs.map((d) => {
      const data = d.data() as { title?: string; city?: string; address?: string; active?: boolean };
      return {
        id: d.id,
        title: String(data.title ?? ""),
        city: String(data.city ?? ""),
        address: String(data.address ?? ""),
        active: Boolean(data.active ?? false),
      };
    });

    const ownerReqCountSnap = await adminDb
      .collection("interestRequests")
      .where("ownerUid", "==", uid)
      .count()
      .get();

    const driverReqCountSnap = await adminDb
      .collection("interestRequests")
      .where("driverUid", "==", uid)
      .count()
      .get();

    return NextResponse.json({
      ok: true,
      user: {
        uid,
        email: authEmail,
        phone: typeof userDoc?.phone === "string" ? userDoc.phone : "",
      },
      counts: {
        stations: stations.length,
        requestsAsOwner: ownerReqCountSnap.data().count,
        requestsAsDriver: driverReqCountSnap.data().count,
      },
      stations,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
