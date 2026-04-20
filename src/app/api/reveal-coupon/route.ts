import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebaseAdmin";
import { isValidPhone, normalizePhoneE164 } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as null | {
      stationId?: string;
      coupon?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      address?: string;
      carType?: string;
    };

    const stationId = body?.stationId?.trim();
    if (!stationId) {
      return NextResponse.json({ error: "Missing stationId" }, { status: 400 });
    }

    const coupon = (body?.coupon ?? "").trim();
    if (coupon !== "עם ישראל") {
      return NextResponse.json({ error: "קופון לא תקין" }, { status: 403 });
    }

    const firstName = (body?.firstName ?? "").trim();
    const lastName = (body?.lastName ?? "").trim();
    const phone = (body?.phone ?? "").trim();
    const address = (body?.address ?? "").trim();
    const email = (body?.email ?? "").trim();
    const carType = (body?.carType ?? "").trim();

    if (!firstName) {
      return NextResponse.json({ error: "חסר לך השם" }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "חסר לך שם משפחה" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "חסר לך טלפון" }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "חסרה לך כתובת" }, { status: 400 });
    }
    if (!carType) {
      return NextResponse.json({ error: "חסר לך סוג הרכב" }, { status: 400 });
    }

    const adminDb = getAdminDb();

    const stationDoc = await adminDb.collection("stations").doc(stationId).get();
    if (!stationDoc.exists) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const station = stationDoc.data() as {
      street?: string;
      exactAddress?: string;
      hostPhone?: string;
      hostName?: string;
      title?: string;
    };

    await adminDb.collection("revealLeads").add({
      stationId,
      firstName,
      lastName,
      email: email || null,
      phone: normalizePhoneE164(phone),
      address,
      carType,
      createdAt: new Date(),
      userAgent: req.headers.get("user-agent") ?? null,
      ipHint:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-appengine-user-ip") ??
        null,
    });

    return NextResponse.json({
      stationId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      contact: {
        phone: station.hostPhone ?? "",
        name: station.hostName ?? "",
      },
      exactAddress: station.street ?? station.exactAddress ?? "",
      title: station.title ?? "עמדה",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
