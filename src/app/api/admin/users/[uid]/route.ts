import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { isValidPhone, normalizePhoneE164 } from "@/lib/phone";

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
          displayName?: string;
          phone?: string;
          notificationPreferences?: { pushEnabled?: boolean; emailEnabled?: boolean };
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
        displayName: typeof userDoc?.displayName === "string" ? userDoc.displayName : "",
        phone: typeof userDoc?.phone === "string" ? userDoc.phone : "",
        notificationPreferences: {
          pushEnabled: userDoc?.notificationPreferences?.pushEnabled ?? true,
          emailEnabled: userDoc?.notificationPreferences?.emailEnabled ?? true,
        },
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

export async function PATCH(
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

    const body = (await req.json().catch(() => null)) as null | {
      email?: string;
      phone?: string;
      displayName?: string;
      notificationPreferences?: { pushEnabled?: boolean; emailEnabled?: boolean };
    };

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (typeof body?.email === "string") {
      const nextEmail = body.email.trim();
      if (!nextEmail || !nextEmail.includes("@")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      await adminAuth.updateUser(uid, { email: nextEmail });
    }

    const updateDoc: Record<string, unknown> = {};

    if (typeof body?.displayName === "string") {
      const v = body.displayName.trim();
      if (!v) {
        return NextResponse.json({ error: "displayName cannot be empty" }, { status: 400 });
      }
      updateDoc.displayName = v;
    }

    if (typeof body?.phone === "string") {
      const raw = body.phone.trim();
      if (raw) {
        if (!isValidPhone(raw)) {
          return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
        }
        updateDoc.phone = normalizePhoneE164(raw);
      } else {
        updateDoc.phone = "";
      }
    }

    if (body?.notificationPreferences && typeof body.notificationPreferences === "object") {
      const prefs: { pushEnabled?: boolean; emailEnabled?: boolean } = {};
      if (typeof body.notificationPreferences.pushEnabled === "boolean") {
        prefs.pushEnabled = body.notificationPreferences.pushEnabled;
      }
      if (typeof body.notificationPreferences.emailEnabled === "boolean") {
        prefs.emailEnabled = body.notificationPreferences.emailEnabled;
      }
      updateDoc.notificationPreferences = prefs;
    }

    if (Object.keys(updateDoc).length > 0) {
      updateDoc.updatedAt = new Date();
      await adminDb.collection("users").doc(uid).set(updateDoc, { merge: true });
    }

    const userDocSnap = await adminDb.collection("users").doc(uid).get();
    const userDoc = userDocSnap.exists
      ? (userDocSnap.data() as {
          displayName?: string;
          phone?: string;
          notificationPreferences?: { pushEnabled?: boolean; emailEnabled?: boolean };
        })
      : null;

    let authEmail = "";
    try {
      const u = await adminAuth.getUser(uid);
      authEmail = (u.email ?? "").trim();
    } catch {
      authEmail = "";
    }

    return NextResponse.json({
      ok: true,
      user: {
        uid,
        email: authEmail,
        displayName: typeof userDoc?.displayName === "string" ? userDoc.displayName : "",
        phone: typeof userDoc?.phone === "string" ? userDoc.phone : "",
        notificationPreferences: {
          pushEnabled: userDoc?.notificationPreferences?.pushEnabled ?? true,
          emailEnabled: userDoc?.notificationPreferences?.emailEnabled ?? true,
        },
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
