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

function systemPrompt(tool: string, locale: string, topic: string, source: string): string {
  const lang = LANG_NAME[locale] ?? "Hebrew";
  if (tool === "shadchan") {
    return [
      "You are 'Shadchan AI' — a warm, insightful matchmaker conducting a personal interview.",
      "Your job: get to know the person deeply through friendly conversation. Ask ONE focused question at a time — never a list of questions. Cover gradually: personality traits, hobbies and interests, family background, religiosity/observance level, culture/nationality, values, career and education, life aspirations, lifestyle, and what they're looking for in a partner.",
      "Be curious and empathetic — react briefly to each answer, ask a natural follow-up, dig deeper on interesting points. React like a real conversation, not a questionnaire.",
      "When you have gathered enough (usually after ~12–18 of their answers), tell them you're wrapping up and produce a structured final summary with two sections:",
      "1) 'Your profile' — who they are: personality, values, background, lifestyle, what they seek in a partner.",
      "2) 'What to check on the other side' — a concrete checklist: compatibility flags, questions to ask a potential match, qualities that fit them, and red flags worth noticing for this specific person.",
      "If they shared their name, use it warmly. Keep replies short — a brief reaction plus one question.",
      `Always respond in ${lang}.`,
    ].filter(Boolean).join("\n");
  }
  if (tool === "teacher") {
    return [
      "You are 'My Teacher' — a patient, expert private tutor who adapts to the student's level.",
      "Teach step by step: explain concepts clearly, give examples and short exercises, check understanding by asking questions, correct mistakes kindly, and encourage progress. Don't just lecture — make it interactive.",
      "Keep replies focused — usually 2–5 sentences plus a question or mini-exercise for the student.",
      `Always respond in ${lang}.`,
      topic ? `The student wants to learn: ${topic}` : "Ask the student what subject and level they'd like to start with.",
      source ? `Material provided by the student:\n---\n${source}\n---` : "",
    ].filter(Boolean).join("\n");
  }
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

async function uploadChatImage(dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m || m[2].length > 4_500_000) return null;
  const mime = m[1].toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpg";
  const path = `chat/${crypto.randomUUID()}.${ext}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/article-images/${path}`, {
      method: "POST",
      headers: { ...dbHeaders, "Content-Type": mime, "x-upsert": "true" },
      body: Buffer.from(m[2], "base64"),
    });
    return res.ok ? `${SUPABASE_URL}/storage/v1/object/public/article-images/${path}` : null;
  } catch {
    return null;
  }
}

async function persist(
  sessionId: string | null,
  fields: { topic?: string; source?: string; locale?: string; author?: string; tool?: string },
  newMessages: { role: "user" | "model"; text: string; image?: string }[],
): Promise<{ sid: string | null; ids: string[] } | null> {
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
          tool: fields.tool || "havruta",
        }),
      });
      const rows = await res.json();
      sid = rows?.[0]?.id ?? null;
      if (!sid) return null;
    }
    if (!sid) return null;

    const ids: string[] = [];
    if (newMessages.length) {
      const rows = await Promise.all(
        newMessages.map(async (m) => ({
          session_id: sid,
          role: m.role,
          content: m.text || "[image]",
          author_name: m.role === "user" ? fields.author || null : null,
          image_url: m.image ? await uploadChatImage(m.image) : null,
        })),
      );
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/havruta_messages`, {
        method: "POST",
        headers: { ...dbHeaders, Prefer: "return=representation" },
        body: JSON.stringify(rows),
      });
      const inserted = await insRes.json().catch(() => []);
      if (Array.isArray(inserted)) {
        for (const r of inserted) if (r?.id) ids.push(r.id);
      }
      await fetch(
        `${SUPABASE_URL}/rest/v1/havruta_sessions?id=eq.${sid}`,
        {
          method: "PATCH",
          headers: { ...dbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ updated_at: new Date().toISOString() }),
        },
      );
    }
    return { sid, ids };
  } catch {
    return null;
  }
}

type Msg = { id?: string; role: string; text: string; image?: string };

function imageParts(image: string): { mime: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(image);
  return m ? { mime: m[1], data: m[2] } : null;
}

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
    tool?: string;
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
  const tool = ["havruta", "teacher", "shadchan"].includes(body.tool ?? "") ? body.tool! : "havruta";
  const sessionId =
    typeof body.sessionId === "string" && /^[0-9a-f-]{36}$/.test(body.sessionId)
      ? body.sessionId
      : null;
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const img = typeof m.image === "string" && m.image.startsWith("data:image/") ? m.image : undefined;
      const text = String(m.text || "").trim().slice(0, MAX_MSG_LEN);
      return {
        role: m.role === "model" ? "model" : "user",
        text: text || (img || m.image ? "[image]" : ""),
        image: img,
      };
    })
    .filter((m) => m.text || m.image);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const contents = messages.map((m) => {
    const img = m.image ? imageParts(m.image) : null;
    const parts: Record<string, unknown>[] = [];
    if (img) parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
    parts.push({ text: m.text || (img ? "Please look at this image and respond." : "") });
    return { role: m.role, parts };
  });

  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt(tool, locale, topic, source) }] },
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
        const persisted = await persist(
          sessionId,
          { topic, source, locale, author: authorName, tool },
          sessionId
            ? [messages[messages.length - 1] as { role: "user" | "model"; text: string; image?: string }, { role: "model", text: reply }]
            : [...messages as { role: "user" | "model"; text: string; image?: string }[], { role: "model", text: reply }],
        );
        return NextResponse.json({
          reply,
          sessionId: persisted?.sid ?? sessionId,
          messageIds: persisted?.ids ?? [],
        });
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
    // Shadchan sessions are private — never listed publicly
    const raw = req.nextUrl.searchParams.get("tool") ?? "";
    const toolFilter = ["havruta", "teacher"].includes(raw)
      ? `&tool=eq.${raw}`
      : `&tool=in.(havruta,teacher)`;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/havruta_sessions?select=id,topic,locale,author_name,updated_at,havruta_messages(count)&order=updated_at.desc&limit=12${toolFilter}`,
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
        `${SUPABASE_URL}/rest/v1/havruta_messages?session_id=eq.${id}&select=id,role,content,author_name,image_url,created_at&order=created_at.asc`,
        { headers: dbHeaders },
      ),
    ]);
    const sessions = await sRes.json();
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const rows = await mRes.json();
    const messages: Msg[] = (Array.isArray(rows) ? rows : []).map(
      (r: { id: string; role: string; content: string; author_name: string | null; image_url: string | null }) => ({
        id: r.id,
        role: r.role,
        text: r.content,
        author: r.author_name ?? undefined,
        image: r.image_url ?? undefined,
      }),
    );
    return NextResponse.json({ session, messages });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

async function adminAuthorized(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_check`, {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({ p_token: token }),
    });
    return res.ok && (await res.json()) === true;
  } catch {
    return false;
  }
}

// Admin: delete a discussion (messages cascade)
export async function DELETE(req: NextRequest) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("session") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/havruta_sessions?id=eq.${id}`, {
      method: "DELETE",
      headers: dbHeaders,
    });
    if (!res.ok) return NextResponse.json({ error: "delete failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// Admin: edit a single message's content
export async function PATCH(req: NextRequest) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { id?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const id = String(body.id || "");
  const content = String(body.content || "").trim().slice(0, MAX_MSG_LEN * 4);
  if (!/^[0-9a-f-]{36}$/.test(id) || !content) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/havruta_messages?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...dbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return NextResponse.json({ error: "update failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
