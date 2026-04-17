import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);

    const snap = await adminDb
      .collection("stations")
      .where("ownerUid", "==", decoded.uid)
      .limit(100)
      .get();

    const stations = snap.docs.map((d) => {
      const data = d.data() as {
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
        exactAddress?: string;
        hostPhone?: string;
        hostName?: string;
        isActive?: boolean;
      };

      return {
        id: d.id,
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
        exactAddress: data.exactAddress,
        hostPhone: data.hostPhone,
        hostName: data.hostName,
        isActive: data.isActive,
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
