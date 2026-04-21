import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const list = await adminAuth.listUsers(200);
    const authUsers = list.users.map((u) => ({
      uid: u.uid,
      email: (u.email ?? "").trim(),
    }));

    const refs = authUsers.map((u) => adminDb.collection("users").doc(u.uid));
    const snaps = refs.length > 0 ? await adminDb.getAll(...refs) : [];
    const phoneByUid = new Map(
      snaps
        .filter((s) => s.exists)
        .map((s) => {
          const data = s.data() as { phone?: string };
          return [s.id, typeof data.phone === "string" ? data.phone : ""] as const;
        })
    );

    const result = authUsers.map((u) => ({
      uid: u.uid,
      email: u.email,
      phone: phoneByUid.get(u.uid) ?? "",
    }));

    return NextResponse.json({ ok: true, users: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
