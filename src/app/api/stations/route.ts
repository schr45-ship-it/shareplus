import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection("stations").limit(50).get();

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
      isActive: data.isActive ?? true,
    };
  });

  return NextResponse.json({ stations });
}
