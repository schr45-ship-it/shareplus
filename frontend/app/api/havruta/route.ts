import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];

const MAX_MESSAGES = 40;
const MAX_TOPIC_LEN = 300;
const MAX_SOURCE_LEN = 8000;
const MAX_MSG_LEN = 3000;
const RATE_LIMIT = 30; // messages per hour per IP (best-effort, per instance)
const WINDOW_MS = 60 * 60 * 1000;

const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  return false;
}

const LANG_NAME: Record<string, string> = {
  he: "Hebrew",
  en: "English",
  es: "Spanish",
  ar: "Arabic",
};

function systemPrompt(locale: string, topic: string, source: string): string {
  const lang = LANG_NAME[locale] ?? "Hebrew";
  return [
    "You are a Havruta — a wise, patient, and thought-provoking Jewish study partner.",
    "Your role is NOT to give dry, ready-made answers. You hold a real discussion: encourage good insights, raise challenges (kushyot) from classical commentators and general philosophy, ask questions that develop independent thinking, and help the learner go deeper into the text.",
    "Keep a warm, eye-level tone in the spirit of shared learning. Keep replies focused — usually 2–5 sentences, ending with a question or a point for the learner to consider.",
    `Always respond in ${lang}.`,
    topic ? `The learner is studying: ${topic}` : "The learner has not specified a text yet — help them choose or sharpen their topic.",
    source ? `Source text provided by the learner:\n---\n${source}\n---` : "",
  ].filter(Boolean).join("\n");
}

const dbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function persist(
  sessionId: string | null,
  fields: { topic?: string; source?: string; locale?: string; author?: string },
  newMessages: { role: "user" | "model"; text: string }[],
): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    let sid = sessionId;
    if (!sid && fields.topic) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/havruta_sessions`, {
        method: "POST",
        headers: { ...dbHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          topic: fields.topic,
          source_text: fields.source || null,
          locale: fields.locale || "he",
          author_name: fields.author || null,
        }),
      });
      const rows = await res.json();
      sid = rows?.[0]?.id ?? null;
      if (!sid) return null;
    }
    if (!sid) return null;

    if (newMessages.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/havruta_messages`, {
        method: "POST",
        headers: { ...dbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify(
          newMessages.map((m) => ({ session_id: sid, role: m.role, content: m.text })),
        ),
      });
      await fetch(
        `${SUPABASE_URL}/rest/v1/havruta_sessions?id=eq.${sid}`,
        {
          method: "PATCH",
          headers: { ...dbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ updated_at: new Date().toISOString() }),
        },
      );
    }
    return sid;
  } catch {
    return null;
  }
}

type Msg = { role: string; text: string };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    topic?: string;
    source?: string;
    messages?: Msg[];
    locale?: string;
    sessionId?: string;
    authorName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const topic = String(body.topic || "").trim().slice(0, MAX_TOPIC_LEN);
  const source = String(body.source || "").trim().slice(0, MAX_SOURCE_LEN);
  const locale = ["he", "en", "es", "ar"].includes(body.locale ?? "") ? body.locale! : "he";
  const authorName = String(body.authorName || "").trim().slice(0, 80);
  const sessionId =
    typeof body.sessionId === "string" && /^[0-9a-f-]{36}$/.test(body.sessionId)
      ? body.sessionId
      : null;
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === "model" ? "model" : "user",
      text: String(m.text || "").trim().slice(0, MAX_MSG_LEN),
    }))
    .filter((m) => m.text);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt(locale, topic, source) }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!res.ok) continue;
      const json = await res.json();
      const reply: string =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim() ?? "";
      if (reply) {
        const sid = await persist(
          sessionId,
          { topic, source, locale, author: authorName },
          sessionId
            ? [messages[messages.length - 1] as { role: "user" | "model"; text: string }, { role: "model", text: reply }]
            : [...messages as { role: "user" | "model"; text: string }[], { role: "model", text: reply }],
        );
        return NextResponse.json({ reply, sessionId: sid ?? sessionId });
      }
    } catch {
      // try next model
    }
  }

  return NextResponse.json({ error: "ai_failed" }, { status: 502 });
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Public list of recent discussions for the community board
  if (req.nextUrl.searchParams.get("list") === "recent") {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/havruta_sessions?select=id,topic,locale,author_name,updated_at,havruta_messages(count)&order=updated_at.desc&limit=12`,
        { headers: dbHeaders, next: { revalidate: 60 } },
      );
      const rows = await res.json();
      const sessions = (Array.isArray(rows) ? rows : []).map(
        (s: { id: string; topic: string; locale: string; author_name: string | null; updated_at: string; havruta_messages?: { count: number }[] }) => ({
          id: s.id,
          topic: s.topic,
          locale: s.locale,
          author_name: s.author_name,
          updated_at: s.updated_at,
          messages: s.havruta_messages?.[0]?.count ?? 0,
        }),
      );
      return NextResponse.json({ sessions });
    } catch {
      return NextResponse.json({ sessions: [] });
    }
  }

  const id = req.nextUrl.searchParams.get("session") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const [sRes, mRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/havruta_sessions?id=eq.${id}&select=*`, {
        headers: dbHeaders,
      }),
      fetch(
        `${SUPABASE_URL}/rest/v1/havruta_messages?session_id=eq.${id}&select=role,content,created_at&order=created_at.asc`,
        { headers: dbHeaders },
      ),
    ]);
    const sessions = await sRes.json();
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const rows = await mRes.json();
    const messages: Msg[] = (Array.isArray(rows) ? rows : []).map(
      (r: { role: string; content: string }) => ({ role: r.role, text: r.content }),
    );
    return NextResponse.json({ session, messages });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
