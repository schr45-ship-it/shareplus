import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/admin";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const stationId = resolved.id;
    if (!stationId) {
      return NextResponse.json({ error: "Missing station id" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const snap = await adminDb.collection("stations").doc(stationId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const data = snap.data() as {
      title?: string;
      connectorType?: string;
      powerKw?: number;
      city?: string;
      region?: string;
      street?: string;
      exactAddress?: string;
      hostName?: string;
      notes?: string;
      hoursStart?: string;
      hoursEnd?: string;
      availability?: Array<{ dayKey: string; enabled: boolean; start: string; end: string }>;
      priceNote?: string;
      pricingType?: string;
      priceIls?: number;
      isActive?: boolean;
    };

    return NextResponse.json({
      station: {
        id: snap.id,
        title: data.title ?? "עמדה",
        connectorType: data.connectorType ?? "Type 2",
        powerKw: data.powerKw ?? 0,
        city: data.city ?? "",
        region: data.region,
        street: data.street,
        exactAddress: data.exactAddress,
        hostName: data.hostName,
        notes: data.notes,
        hoursStart: data.hoursStart,
        hoursEnd: data.hoursEnd,
        availability: Array.isArray(data.availability) ? data.availability : undefined,
        priceNote: data.priceNote,
        pricingType: data.pricingType,
        priceIls: data.priceIls,
        isActive: data.isActive ?? true,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = _req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const stationId = resolved.id;
    if (!stationId) {
      return NextResponse.json({ error: "Missing station id" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);

    const ref = adminDb.collection("stations").doc(stationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const data = snap.data() as { ownerUid?: string };

    const email = (decoded.email ?? "").toLowerCase();
    const isAdmin = isAdminEmail(email);
    const isOwner = Boolean(data.ownerUid) && data.ownerUid === decoded.uid;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ref.delete();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
