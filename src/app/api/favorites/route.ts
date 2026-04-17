import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);

    const favSnap = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("favorites")
      .limit(200)
      .get();

    const ids = favSnap.docs.map((d) => d.id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ stations: [] });

    const refs = ids.map((id) => adminDb.collection("stations").doc(id));
    const stationSnaps = await adminDb.getAll(...refs);

    const stations = stationSnaps
      .filter((s) => s.exists)
      .map((s) => {
        const data = s.data() as {
          title?: string;
          connectorType?: string;
          powerKw?: number;
          city?: string;
          region?: string;
          notes?: string;
          hoursStart?: string;
          hoursEnd?: string;
          priceNote?: string;
          pricingType?: string;
          priceIls?: number;
        };

        return {
          id: s.id,
          title: data.title ?? "עמדה",
          connectorType: data.connectorType ?? "Type 2",
          powerKw: data.powerKw ?? 11,
          city: data.city ?? "",
          region: data.region,
          notes: data.notes,
          hoursStart: data.hoursStart,
          hoursEnd: data.hoursEnd,
          priceNote: data.priceNote,
          pricingType: data.pricingType,
          priceIls: data.priceIls,
        };
      });

    return NextResponse.json({ stations });
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
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as null | { stationId?: string };
    const stationId = body?.stationId;
    if (!stationId) return NextResponse.json({ error: "Missing stationId" }, { status: 400 });

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);

    await adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("favorites")
      .doc(stationId)
      .set({ createdAt: new Date() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const url = new URL(req.url);
    const stationId = url.searchParams.get("stationId") ?? "";
    if (!stationId) return NextResponse.json({ error: "Missing stationId" }, { status: 400 });

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);

    await adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("favorites")
      .doc(stationId)
      .delete();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
