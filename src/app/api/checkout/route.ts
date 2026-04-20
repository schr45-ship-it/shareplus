import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { isValidPhone } from "@/lib/phone";
import { getStripe } from "@/lib/stripe";

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

    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const phone = userSnap.exists ? String((userSnap.data() as { phone?: string }).phone ?? "") : "";
    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "כדי לבצע תשלום חובה לשמור מספר טלפון תקין בפרופיל" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as null | {
      stationId?: string;
    };

    const stationId = body?.stationId;
    if (!stationId) {
      return NextResponse.json({ error: "Missing stationId" }, { status: 400 });
    }

    const stripe = getStripe();

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_ORIGIN;
    if (!origin) {
      return NextResponse.json(
        { error: "Missing origin (set NEXT_PUBLIC_APP_ORIGIN for server-side requests)" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "ils",
            unit_amount: 100,
            product_data: {
              name: "SharePlus - חשיפת פרטי קשר (שבוע)",
            },
          },
        },
      ],
      success_url: `${origin}/reveal?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
      metadata: {
        stationId,
        uid: decoded.uid,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a redirect URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
