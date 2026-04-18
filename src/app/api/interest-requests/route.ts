import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";

function parseHHMM(v: string) {
  const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h * 60 + min;
}

function dayKeyFromDate(dateIso: string):
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | null {
  const d = new Date(`${dateIso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  const idx = d.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[idx] ?? null;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as null | {
      stationId?: string;
      date?: string;
      timeFrom?: string;
      timeTo?: string;
    };

    const stationId = (body?.stationId ?? "").trim();
    const date = (body?.date ?? "").trim();
    const timeFrom = (body?.timeFrom ?? "").trim();
    const timeTo = (body?.timeTo ?? "").trim();

    if (!stationId) return NextResponse.json({ error: "Missing stationId" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });
    if (!timeFrom) return NextResponse.json({ error: "Missing timeFrom" }, { status: 400 });
    if (!timeTo) return NextResponse.json({ error: "Missing timeTo" }, { status: 400 });

    const reqFrom = parseHHMM(timeFrom);
    const reqTo = parseHHMM(timeTo);
    if (reqFrom == null || reqTo == null || reqFrom >= reqTo) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    const dayKey = dayKeyFromDate(date);
    if (!dayKey) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const adminDb = getAdminDb();
    const stSnap = await adminDb.collection("stations").doc(stationId).get();
    if (!stSnap.exists) return NextResponse.json({ error: "Station not found" }, { status: 404 });

    const st = stSnap.data() as {
      title?: string;
      ownerUid?: string;
      availability?: Array<{ dayKey: string; enabled: boolean; start: string; end: string }>;
    };

    const ownerUid = st.ownerUid;
    if (!ownerUid) {
      return NextResponse.json({ error: "Station has no owner" }, { status: 400 });
    }

    const avail = Array.isArray(st.availability) ? st.availability : [];
    const slot = avail.find((a) => a?.enabled && a.dayKey === dayKey);
    if (!slot) {
      return NextResponse.json({ error: "Station not available on selected day" }, { status: 409 });
    }

    const slotFrom = parseHHMM(String(slot.start ?? ""));
    const slotTo = parseHHMM(String(slot.end ?? ""));
    if (slotFrom == null || slotTo == null) {
      return NextResponse.json({ error: "Station availability is invalid" }, { status: 409 });
    }

    const overlaps = reqFrom < slotTo && reqTo > slotFrom;
    if (!overlaps) {
      return NextResponse.json({ error: "Station not available in selected time" }, { status: 409 });
    }

    const now = new Date();
    const requestRef = await adminDb.collection("interestRequests").add({
      stationId,
      ownerUid,
      driverUid: decoded.uid,
      date,
      timeFrom,
      timeTo,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    const tokensSnap = await adminDb
      .collection("users")
      .doc(ownerUid)
      .collection("pushTokens")
      .get();

    const tokens = tokensSnap.docs
      .map((d) => (d.data() as { token?: string }).token)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

    if (tokens.length > 0) {
      const messaging = getAdminMessaging();
      await messaging.sendEachForMulticast({
        tokens,
        data: {
          type: "INTEREST_REQUEST",
          requestId: requestRef.id,
          stationId,
          title: "יש מתעניין מ-SharePlus!",
          body: `לתאריך ${date} בין השעות ${timeFrom}-${timeTo}. האם פנוי אצלך?`,
          deepLink: `/?requestId=${encodeURIComponent(requestRef.id)}`,
        },
      });
    }

    return NextResponse.json({ ok: true, requestId: requestRef.id, stationTitle: st.title ?? "עמדה" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
