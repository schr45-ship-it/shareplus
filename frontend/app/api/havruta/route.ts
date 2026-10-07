import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];

const MAX_MESSAGES = 40;
const MAX_TOPIC_LEN = 300;
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

function systemPrompt(locale: string, topic: string): string {
  const lang = LANG_NAME[locale] ?? "Hebrew";
  return [
    "You are a Havruta — a wise, patient, and thought-provoking Jewish study partner.",
    "Your role is NOT to give dry, ready-made answers. You hold a real discussion: encourage good insights, raise challenges (kushyot) from classical commentators and general philosophy, ask questions that develop independent thinking, and help the learner go deeper into the text.",
    "Keep a warm, eye-level tone in the spirit of shared learning. Keep replies focused — usually 2–5 sentences, ending with a question or a point for the learner to consider.",
    `Always respond in ${lang}.`,
    topic ? `The learner is studying: ${topic}` : "The learner has not specified a text yet — help them choose or sharpen their topic.",
  ].join("\n");
}

type Msg = { role: string; text: string };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { topic?: string; messages?: Msg[]; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const topic = String(body.topic || "").trim().slice(0, MAX_TOPIC_LEN);
  const locale = ["he", "en", "es", "ar"].includes(body.locale ?? "") ? body.locale! : "he";
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
            system_instruction: { parts: [{ text: systemPrompt(locale, topic) }] },
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
      if (reply) return NextResponse.json({ reply });
    } catch {
      // try next model
    }
  }

  return NextResponse.json({ error: "ai_failed" }, { status: 502 });
}
