import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { digitsOnlyPhone, isValidPhone, normalizePhoneE164 } from "@/lib/phone";

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ error: "Missing auth token" }, { status: 401 }) };
  }
  const adminAuth = getAdminAuth();
  const decoded = await adminAuth.verifyIdToken(token);
  return { uid: decoded.uid };
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => null)) as null | {
      requestId?: string;
      coupon?: string;
    };

    const requestId = String(body?.requestId ?? "").trim();
    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    const coupon = String(body?.coupon ?? "").trim();
    if (coupon !== "עם ישראל") {
      return NextResponse.json({ error: "קופון לא תקין" }, { status: 403 });
    }

    const adminDb = getAdminDb();
    const reqSnap = await adminDb.collection("interestRequests").doc(requestId).get();
    if (!reqSnap.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const reqData = reqSnap.data() as { ownerUid?: string; driverUid?: string; status?: string };
    const ownerUid = String(reqData.ownerUid ?? "");
    const driverUid = String(reqData.driverUid ?? "");
    const status = String(reqData.status ?? "pending").toLowerCase();

    if (!ownerUid || ownerUid !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status !== "approved") {
      return NextResponse.json({ error: "Request not approved" }, { status: 409 });
    }

    if (!driverUid) {
      return NextResponse.json({ error: "Missing driverUid" }, { status: 400 });
    }

    const driverSnap = await adminDb.collection("users").doc(driverUid).get();
    const driverPhoneRaw = driverSnap.exists
      ? String((driverSnap.data() as { phone?: string }).phone ?? "")
      : "";

    if (!isValidPhone(driverPhoneRaw)) {
      return NextResponse.json({ error: "Driver phone not available" }, { status: 404 });
    }

    const e164 = normalizePhoneE164(driverPhoneRaw);
    const whatsappDigits = digitsOnlyPhone(e164);

    return NextResponse.json({
      ok: true,
      phone: driverPhoneRaw,
      whatsappDigits,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
