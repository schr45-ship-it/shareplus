import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

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

function toIsoMaybe(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "toDate" in (v as Record<string, unknown>)) {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return d instanceof Date ? d.toISOString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const requestId = (url.searchParams.get("requestId") ?? "").trim();
    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection("interestRequests").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const data = snap.data() as {
      stationId?: string;
      ownerUid?: string;
      driverUid?: string;
      date?: string;
      timeFrom?: string;
      timeTo?: string;
      status?: string;
      createdAt?: unknown;
    };

    const ownerUid = String(data.ownerUid ?? "");
    const driverUid = String(data.driverUid ?? "");

    if (auth.uid !== ownerUid && auth.uid !== driverUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stationId = String(data.stationId ?? "");
    const stSnap = stationId ? await adminDb.collection("stations").doc(stationId).get() : null;
    const st = stSnap?.exists ? (stSnap.data() as { title?: string; city?: string }) : null;

    return NextResponse.json({
      ok: true,
      request: {
        id: requestId,
        stationId,
        stationTitle: st?.title ?? "עמדה",
        stationCity: st?.city ?? null,
        date: String(data.date ?? ""),
        timeFrom: String(data.timeFrom ?? ""),
        timeTo: String(data.timeTo ?? ""),
        status: String(data.status ?? "pending"),
        createdAt: toIsoMaybe(data.createdAt),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
