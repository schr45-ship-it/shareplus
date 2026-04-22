import { NextResponse } from "next/server";

type QuizQuestion = {
  q: string;
  a: string[];
  c: number;
  explanation?: string;
};

function pickJsonFromText(raw: string): QuizQuestion | null {
  const trimmed = raw.trim();

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const mid = trimmed.slice(start, end + 1);
    const parsed = tryParse(mid);
    if (parsed) return parsed;
  }

  return null;

  function tryParse(s: string): QuizQuestion | null {
    try {
      const obj = JSON.parse(s) as Partial<QuizQuestion>;
      if (!obj || typeof obj !== "object") return null;
      if (typeof obj.q !== "string" || !obj.q.trim()) return null;
      if (!Array.isArray(obj.a) || obj.a.length !== 4) return null;
      if (!obj.a.every((x) => typeof x === "string" && x.trim().length > 0)) return null;
      if (typeof obj.c !== "number" || !Number.isInteger(obj.c) || obj.c < 0 || obj.c > 3) return null;
      return {
        q: obj.q,
        a: obj.a,
        c: obj.c,
        explanation: typeof obj.explanation === "string" ? obj.explanation : undefined,
      };
    } catch {
      return null;
    }
  }
}

export async function GET() {
  try {
    const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const prompt =
      "צור שאלה מקורית קצרה בעברית ל'חידון יום העצמאות' עם 4 תשובות אפשריות. החזר JSON בלבד בצורה: {\"q\":string,\"a\":[string,string,string,string],\"c\":0|1|2|3,\"explanation\":string}. אל תוסיף טקסט נוסף מעבר ל-JSON.";

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 400,
          },
        }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg = json?.error?.message ? String(json.error.message) : "Gemini request failed";
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    const text =
      json?.candidates?.[0]?.content?.parts?.map((p) => String(p?.text ?? "")).join("\n") ?? "";

    const parsed = pickJsonFromText(text);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: "Could not parse Gemini response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, question: parsed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
