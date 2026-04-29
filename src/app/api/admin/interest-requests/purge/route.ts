import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : Number(String(v ?? ""));
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as null | {
      olderThanDays?: number;
      includePending?: boolean;
    };

    const olderThanDays = clampInt(body?.olderThanDays, 1, 3650, 30);
    const includePending = Boolean(body?.includePending);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const adminDb = getAdminDb();
    const base = adminDb.collection("interestRequests");

    const allowedFinal = new Set(["approved", "rejected", "closed", "cancelled"]);

    let deleted = 0;
    let scanned = 0;

    while (true) {
      const snap = await base.orderBy("createdAt", "asc").where("createdAt", "<", cutoff).limit(450).get();
      if (snap.empty) break;

      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        scanned++;
        const data = doc.data() as { status?: string };
        const status = String(data.status ?? "pending").toLowerCase();

        const shouldDelete = includePending ? true : allowedFinal.has(status);
        if (!shouldDelete) continue;

        batch.delete(doc.ref);
        batchCount++;
        deleted++;

        if (batchCount >= 450) break;
      }

      if (batchCount === 0) {
        break;
      }

      await batch.commit();
    }

    return NextResponse.json({ ok: true, olderThanDays, includePending, cutoff: cutoff.toISOString(), scanned, deleted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
