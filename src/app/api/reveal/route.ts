import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";
import { sendEmailSendGrid } from "@/lib/sendgrid";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function digitsOnlyPhone(v: string) {
  return String(v ?? "").replace(/[^0-9]/g, "");
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(token);

    const body = (await req.json().catch(() => null)) as null | {
      sessionId?: string;
    };
    const sessionId = body?.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }

    const stationId = session.metadata?.stationId;
    const sessionUid = session.metadata?.uid;

    if (!stationId || !sessionUid) {
      return NextResponse.json({ error: "Missing metadata in session" }, { status: 500 });
    }

    if (sessionUid !== decoded.uid) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const now = Date.now();
    const expiresAt = new Date(now + WEEK_MS);

    const purchaseId = `${decoded.uid}_${stationId}`;

    const purchaseRef = adminDb.collection("revealPurchases").doc(purchaseId);
    const purchaseSnap = await purchaseRef.get();
    const alreadyNotifiedOwner = purchaseSnap.exists
      ? Boolean((purchaseSnap.data() as { ownerNotifiedAt?: unknown }).ownerNotifiedAt)
      : false;

    await purchaseRef.set(
      {
        uid: decoded.uid,
        stationId,
        stripeSessionId: session.id,
        expiresAt,
        updatedAt: new Date(now),
        createdAt: new Date(now),
      },
      { merge: true }
    );

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
      ownerUid?: string;
    };

    const ownerPhone = station.hostPhone ?? "";
    const ownerWhatsappUrl = ownerPhone ? `https://wa.me/${digitsOnlyPhone(ownerPhone)}` : "";

    if (!alreadyNotifiedOwner) {
      const ownerUid = (station.ownerUid ?? "").trim();
      if (ownerUid) {
        const seekerUserSnap = await adminDb.collection("users").doc(decoded.uid).get();
        const seekerPhone = seekerUserSnap.exists
          ? String((seekerUserSnap.data() as { phone?: string }).phone ?? "")
          : "";
        const seekerWhatsappUrl = seekerPhone ? `https://wa.me/${digitsOnlyPhone(seekerPhone)}` : "";

        const ownerSnap = await adminDb.collection("users").doc(ownerUid).get();
        const ownerData = ownerSnap.exists
          ? (ownerSnap.data() as {
              notificationPreferences?: { pushEnabled?: boolean; emailEnabled?: boolean };
            })
          : null;
        const pushEnabled = ownerData?.notificationPreferences?.pushEnabled ?? true;
        const emailEnabled = ownerData?.notificationPreferences?.emailEnabled ?? false;

        if (pushEnabled) {
          const tokensSnap = await adminDb
            .collection("users")
            .doc(ownerUid)
            .collection("pushTokens")
            .get();

          const tokens = tokensSnap.docs
            .map((d) => (d.data() as { token?: string }).token)
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

          if (tokens.length > 0) {
            const title = "SharePlus – חשיפה בוצעה";
            const body = seekerPhone
              ? `משתמש שילם וחשף פרטים. טלפון המחפש: ${seekerPhone}`
              : "משתמש שילם וחשף פרטים. טלפון המחפש לא נשמר בפרופיל.";
            await getAdminMessaging().sendEachForMulticast({
              tokens,
              data: {
                type: "REVEAL_PURCHASED",
                stationId,
                title,
                body,
                seekerPhone,
                seekerWhatsappUrl,
                deepLink: `/stations/${encodeURIComponent(stationId)}`,
              },
            });
          }
        }

        if (emailEnabled) {
          try {
            const ownerUser = await adminAuth.getUser(ownerUid);
            const ownerEmail = (ownerUser.email ?? "").trim();
            if (ownerEmail) {
              const subject = "SharePlus – משתמש חשף פרטים לאחר תשלום";
              const text = seekerPhone
                ? `משתמש שילם וחשף פרטים לעמדה שלך (${station.title ?? "עמדה"}).\nטלפון המחפש: ${seekerPhone}${seekerWhatsappUrl ? `\nWhatsApp: ${seekerWhatsappUrl}` : ""}\n`
                : `משתמש שילם וחשף פרטים לעמדה שלך (${station.title ?? "עמדה"}).\nטלפון המחפש לא נשמר בפרופיל.\n`;
              await sendEmailSendGrid({ to: ownerEmail, subject, text });
            }
          } catch {
            // best-effort
          }
        }

        await purchaseRef.set(
          {
            ownerNotifiedAt: new Date(now),
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json({
      stationId,
      expiresAt: expiresAt.toISOString(),
      contact: {
        phone: ownerPhone,
        name: station.hostName ?? "",
        whatsappUrl: ownerWhatsappUrl,
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
