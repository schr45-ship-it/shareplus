import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const WEB3FORMS_KEY = process.env.WEB3FORMS_ACCESS_KEY || "";
const CONTACT_EMAIL = "underup.org@gmail.com";

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    email?: string;
    message?: string;
    captcha?: string;
    captchaExpected?: string;
    website?: string; // honeypot — must stay empty
    locale?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 4000);

  // Honeypot: bots fill hidden fields
  if (body.website) return NextResponse.json({ ok: true });
  // Simple math verification
  if (
    !body.captcha ||
    String(body.captcha).trim() !== String(body.captchaExpected ?? "")
  ) {
    return NextResponse.json({ error: "captcha" }, { status: 400 });
  }
  if (!name || !email.includes("@") || message.length < 5) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Store in DB (always works even if email delivery isn't configured)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, email, message, locale: body.locale || null }),
    });
  } catch {
    // continue — still try email
  }

  // Optional: forward to email via Web3Forms (key configured server-side only,
  // so the address is never exposed to visitors or bots)
  if (WEB3FORMS_KEY) {
    try {
      await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          to: CONTACT_EMAIL,
          subject: `SharePlus contact: ${name}`,
          from_name: name,
          replyto: email,
          message: `From: ${name} <${email}>\n\n${message}`,
        }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
