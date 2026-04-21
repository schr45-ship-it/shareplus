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

    let snap;
    try {
      snap = await adminDb
        .collection("users")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
    } catch {
      snap = await adminDb.collection("users").limit(200).get();
    }

    const users = snap.docs.map((d) => {
      const data = d.data() as {
        phone?: string;
        createdAt?: unknown;
      };
      return {
        uid: d.id,
        phone: typeof data.phone === "string" ? data.phone : "",
        createdAt: data.createdAt ?? null,
      };
    });

    let authUsers: Array<{ uid: string; email: string }>; 
    try {
      const list = await adminAuth.listUsers(200);
      authUsers = list.users
        .map((u) => ({ uid: u.uid, email: (u.email ?? "").trim() }))
        .filter((u) => u.email);
    } catch {
      authUsers = [];
    }

    const emailByUid = new Map(authUsers.map((u) => [u.uid, u.email]));

    const result = users.map((u) => ({
      ...u,
      email: emailByUid.get(u.uid) ?? "",
    }));

    return NextResponse.json({ ok: true, users: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
