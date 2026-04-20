import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";
import { digitsOnlyPhone, isValidPhone } from "@/lib/phone";
import { sendEmailSendGrid } from "@/lib/sendgrid";

function isIndexBuildingError(e: unknown) {
  const msg =
    e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string"
      ? String((e as { message: string }).message)
      : "";
  return msg.includes("FAILED_PRECONDITION") && msg.includes("index") && msg.includes("building");
}

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

function formatDateIL(dateIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!m) return dateIso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

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

export async function GET(req: Request) {
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "received").trim();
    const resolvedScope = scope === "sent" ? "sent" : "received";

    const adminDb = getAdminDb();
    const base = adminDb.collection("interestRequests");
    const q =
      resolvedScope === "received"
        ? base.where("ownerUid", "==", auth.uid).limit(50)
        : base.where("driverUid", "==", auth.uid).limit(50);

    const snap = await q.get();
    const raw = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown>
    );

    const stationIds = Array.from(
      new Set(raw.map((r) => String(r.stationId ?? "")).filter((v) => v))
    );
    const userUids = Array.from(
      new Set(
        raw
          .map((r) =>
            resolvedScope === "received" ? String(r.driverUid ?? "") : String(r.ownerUid ?? "")
          )
          .filter((v) => v)
      )
    );

    const stationSnaps = await Promise.all(
      stationIds.map(async (id) => ({ id, snap: await adminDb.collection("stations").doc(id).get() }))
    );
    const stationById = new Map(
      stationSnaps
        .filter((x) => x.snap.exists)
        .map((x) => [x.id, x.snap.data() as Record<string, unknown>])
    );

    const userSnaps = await Promise.all(
      userUids.map(async (uid) => ({ uid, snap: await adminDb.collection("users").doc(uid).get() }))
    );
    const userByUid = new Map(
      userSnaps
        .filter((x) => x.snap.exists)
        .map((x) => [x.uid, x.snap.data() as Record<string, unknown>])
    );

    const items = raw
      .map((r) => {
        const stationId = String(r.stationId ?? "");
        const st = stationById.get(stationId) ?? null;

        const otherUid =
          resolvedScope === "received" ? String(r.driverUid ?? "") : String(r.ownerUid ?? "");
        const other = userByUid.get(otherUid) ?? null;

        const ownerPaidFee = Boolean(r.ownerPaidFee);

        const createdAt = r.createdAt as unknown;
        const createdAtIso =
          createdAt && typeof createdAt === "object" && "toDate" in (createdAt as Record<string, unknown>)
            ? ((createdAt as { toDate: () => Date }).toDate().toISOString() as string)
            : createdAt instanceof Date
              ? createdAt.toISOString()
              : null;

        const updatedAt = r.updatedAt as unknown;
        const updatedAtIso =
          updatedAt && typeof updatedAt === "object" && "toDate" in (updatedAt as Record<string, unknown>)
            ? ((updatedAt as { toDate: () => Date }).toDate().toISOString() as string)
            : updatedAt instanceof Date
              ? updatedAt.toISOString()
              : null;

        return {
          id: String(r.id),
          stationId,
          stationTitle: (st?.title as string | undefined) ?? "עמדה",
          stationCity: (st?.city as string | undefined) ?? null,
          stationPriceIls: (st?.priceIls as number | undefined) ?? null,
          stationHostPhone:
            resolvedScope === "sent" && ownerPaidFee
              ? String((st?.hostPhone as string | undefined) ?? "")
              : null,
          ownerUid: String(r.ownerUid ?? ""),
          driverUid: String(r.driverUid ?? ""),
          otherUid,
          otherDisplayName: (other?.displayName as string | undefined) ?? null,
          date: String(r.date ?? ""),
          timeFrom: String(r.timeFrom ?? ""),
          timeTo: String(r.timeTo ?? ""),
          status: String(r.status ?? "pending"),
          ownerPaidFee,
          finalCostNis: typeof r.finalCostNis === "number" ? r.finalCostNis : null,
          estimatedProfitNis: typeof r.estimatedProfitNis === "number" ? r.estimatedProfitNis : null,
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
        };
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return NextResponse.json({ ok: true, scope: resolvedScope, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => null)) as null | {
      requestId?: string;
      status?: "pending" | "approved" | "rejected" | "closed" | "cancelled";
      finalCostNis?: number;
      estimatedProfitNis?: number;
      ownerPaidFee?: boolean;
    };

    const requestId = (body?.requestId ?? "").trim();
    const nextStatus = (body?.status ?? "").trim() as
      | "pending"
      | "approved"
      | "rejected"
      | "closed"
      | "cancelled";

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }
    if (!nextStatus) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection("interestRequests").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const data = snap.data() as {
      ownerUid?: string;
      driverUid?: string;
      stationId?: string;
      status?: string;
    };
    const ownerUid = data.ownerUid ?? "";
    const driverUid = data.driverUid ?? "";
    const stationId = String(data.stationId ?? "");
    const currentStatus = data.status ?? "pending";

    const isOwner = ownerUid === auth.uid;
    const isDriver = driverUid === auth.uid;

    if (!isOwner && !isDriver) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ownerAllowed = new Set(["approved", "rejected", "closed"]);
    const driverAllowed = new Set(["cancelled"]);
    const allowed = isOwner ? ownerAllowed : driverAllowed;

    if (!allowed.has(nextStatus)) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }

    if (currentStatus === "closed" || currentStatus === "rejected" || currentStatus === "cancelled") {
      return NextResponse.json({ error: "Request already finalized" }, { status: 409 });
    }

    const patch: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: new Date(),
      history: FieldValue.arrayUnion({
        at: new Date(),
        byUid: auth.uid,
        action: nextStatus,
      }),
    };

    if (typeof body?.finalCostNis === "number") {
      patch.finalCostNis = body.finalCostNis;
    }
    if (typeof body?.estimatedProfitNis === "number") {
      patch.estimatedProfitNis = body.estimatedProfitNis;
    }

    if (typeof body?.ownerPaidFee === "boolean") {
      if (!isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (nextStatus !== "approved") {
        return NextResponse.json({ error: "ownerPaidFee can only be set on approval" }, { status: 400 });
      }
      patch.ownerPaidFee = body.ownerPaidFee;
    }

    await ref.set(patch, { merge: true });

    if (nextStatus === "approved" && currentStatus === "pending" && driverUid) {
      try {
        const adminDb = getAdminDb();
        const driverSnap = await adminDb.collection("users").doc(driverUid).get();
        const driverData = driverSnap.exists
          ? (driverSnap.data() as {
              notificationPreferences?: { pushEnabled?: boolean };
            })
          : null;
        const pushEnabled = driverData?.notificationPreferences?.pushEnabled ?? true;

        if (pushEnabled) {
          const tokensSnap = await adminDb
            .collection("users")
            .doc(driverUid)
            .collection("pushTokens")
            .get();

          const tokens = tokensSnap.docs
            .map((d) => (d.data() as { token?: string }).token)
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

          if (tokens.length > 0) {
            await getAdminMessaging().sendEachForMulticast({
              tokens,
              data: {
                type: "INTEREST_REQUEST_APPROVED",
                requestId,
                stationId,
                title: "SharePlus – הבקשה אושרה",
                body: "בעל העמדה אישר את הבקשה. כדי להמשיך – היכנס וצפה בפרטים.",
                deepLink: stationId ? `/stations/${encodeURIComponent(stationId)}` : "/",
              },
            });
          }
        }
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => null)) as null | {
      stationId?: string;
      date?: string;
      timeFrom?: string;
      timeTo?: string;
      coupon?: string;
    };

    const stationId = (body?.stationId ?? "").trim();
    const date = (body?.date ?? "").trim();
    const timeFrom = (body?.timeFrom ?? "").trim();
    const timeTo = (body?.timeTo ?? "").trim();
    const coupon = (body?.coupon ?? "").trim();

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

    const adminDb = getAdminDb();

    const driverSnap = await adminDb.collection("users").doc(auth.uid).get();
    const driverPhone = driverSnap.exists
      ? String((driverSnap.data() as { phone?: string }).phone ?? "")
      : "";
    if (!isValidPhone(driverPhone)) {
      return NextResponse.json(
        { error: "כדי לשלוח בקשה חובה לשמור מספר טלפון תקין בפרופיל" },
        { status: 400 }
      );
    }
    const driverPhoneDigits = digitsOnlyPhone(driverPhone);

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const todaySnap = await adminDb
      .collection("interestRequests")
      .where("driverUid", "==", auth.uid)
      .where("createdAt", ">=", dayStart)
      .limit(50)
      .get();

    const todayNonRejectedCount = todaySnap.docs.filter((d) => {
      const data = d.data() as { status?: string };
      const s = (data.status ?? "pending").toLowerCase();
      return s !== "rejected" && s !== "cancelled";
    }).length;

    const baseDailyLimit = 10;
    const couponBonus = coupon === "שרפלוס" ? 3 : 0;
    const dailyLimit = baseDailyLimit + couponBonus;

    if (todayNonRejectedCount >= dailyLimit) {
      return NextResponse.json(
        {
          error:
            "הגעת למגבלת הבקשות היומית. נסה שוב מחר. אם יש לך קופון, ניתן להזין אותו ולנסות שוב.",
        },
        { status: 429 }
      );
    }

    const stSnap = await adminDb.collection("stations").doc(stationId).get();
    if (!stSnap.exists) return NextResponse.json({ error: "Station not found" }, { status: 404 });

    const st = stSnap.data() as {
      title?: string;
      ownerUid?: string;
      city?: string;
      hostPhone?: string;
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

    const requestRef = await adminDb.collection("interestRequests").add({
      stationId,
      ownerUid,
      driverUid: auth.uid,
      date,
      timeFrom,
      timeTo,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, byUid: auth.uid, action: "created" }],
    });

    const ownerSnap = await adminDb.collection("users").doc(ownerUid).get();
    const ownerData = ownerSnap.exists
      ? (ownerSnap.data() as {
          notificationPreferences?: { pushEnabled?: boolean; emailEnabled?: boolean };
        })
      : null;
    const emailEnabled = ownerData?.notificationPreferences?.emailEnabled ?? false;

    let emailSendError: string | null = null;

    const ownerPhoneRaw = String(st.hostPhone ?? "").trim();
    if (ownerPhoneRaw) {
      const ownerPhoneForMacro = digitsOnlyPhone(ownerPhoneRaw);
      if (ownerPhoneForMacro) {
        const approveUrl = `https://shareplus.co.il/approve/${encodeURIComponent(
          stationId
        )}?requestId=${encodeURIComponent(requestRef.id)}`;
        const stationLabel = `${st.title ?? "עמדה"}${st.city ? ` (${st.city})` : ""}`;
        const message = `${approveUrl} מישהו רוצה להטעין אצלך בעמדה: ${stationLabel}. בקשה לתאריך ${date} שעה ${timeFrom}-${timeTo}. לעדכון זמינות ואישור/אי אישור לחץ על הקישור הבא: ${approveUrl}`;

        const macroBase =
          "https://trigger.macrodroid.com/ce572bd5-5c2b-45c0-9dcd-2b33e5c33aba/send_sms";
        const macroDroidUrl = `${macroBase}?msg=${encodeURIComponent(message)}`;
        try {
          await fetch(macroDroidUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: ownerPhoneForMacro,
          });
        } catch {
          // ignore
        }
      }
    }

    if (emailEnabled) {
      try {
        const adminAuth = getAdminAuth();
        const ownerUser = await adminAuth.getUser(ownerUid);
        const ownerEmail = (ownerUser.email ?? "").trim();
        if (ownerEmail) {
          const subject = "SharePlus – בקשת התעניינות חדשה";
          const text = `יש בקשת התעניינות חדשה לעמדה שלך (${st.title ?? "עמדה"}).\nתאריך: ${date}\nשעה: ${timeFrom}-${timeTo}\n`;
          await sendEmailSendGrid({ to: ownerEmail, subject, text });
        }
      } catch (e) {
        emailSendError = e instanceof Error ? e.message : "Unexpected email error";
      }
    }

    return NextResponse.json({
      ok: true,
      requestId: requestRef.id,
      stationTitle: st.title ?? "עמדה",
      emailSent: emailEnabled && !emailSendError,
      emailError: emailSendError,
    });
  } catch (e) {
    if (isIndexBuildingError(e)) {
      return NextResponse.json(
        { error: "האינדקס בבסיס הנתונים עדיין נבנה. נסה שוב בעוד כמה דקות." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
