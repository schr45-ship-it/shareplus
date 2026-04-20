import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const usersCountSnap = await adminDb.collection("users").count().get();
    const requestsCountSnap = await adminDb.collection("interestRequests").count().get();

    const approvedCountSnap = await adminDb
      .collection("interestRequests")
      .where("status", "==", "approved")
      .count()
      .get();

    const closedCountSnap = await adminDb
      .collection("interestRequests")
      .where("status", "==", "closed")
      .count()
      .get();

    const couponRevealCountSnap = await adminDb
      .collection("interestRequests")
      .where("ownerCouponUsed", "==", "עם ישראל")
      .count()
      .get();

    const paidCountSnap = await adminDb.collection("revealLeads").count().get();

    return NextResponse.json({
      ok: true,
      users: usersCountSnap.data().count,
      interestRequests: requestsCountSnap.data().count,
      approvedRequests: approvedCountSnap.data().count,
      closedRequests: closedCountSnap.data().count,
      completedProcess: closedCountSnap.data().count,
      couponReveals: couponRevealCountSnap.data().count,
      paid: paidCountSnap.data().count,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
