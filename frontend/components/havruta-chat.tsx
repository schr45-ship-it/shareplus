"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "model"; text: string };

const texts: Record<
  string,
  {
    title: string;
    intro: string;
    topicPlaceholder: string;
    startBtn: string;
    suggestions: string[];
    inputPlaceholder: string;
    send: string;
    thinking: string;
    newTopic: string;
    listening: string;
    micNotSupported: string;
    errGeneric: string;
    errRate: string;
  }
> = {
  he: {
    title: "חברותא AI",
    intro: "בחר נושא או טקסט — פסוק, משנה, מאמר — והתחל דיון לימודי אמיתי. החברותא יקשה, יעודד ויעמיק איתך.",
    topicPlaceholder: "לדוגמה: בראשית פרק א׳ פסוקים ג׳–ד׳, או: מסכת ברכות דף ב׳",
    startBtn: "התחל לימוד",
    suggestions: [
      "בראשית פרק א׳ פסוקים ג׳–ד׳",
      "מסכת ברכות דף ב׳ — ממתי קורין את שמע",
      "עשרת הדיברות — מה ההבדל בין חובה לאיסור?",
      "שיר השירים — אהבה או אלוהות?",
    ],
    inputPlaceholder: "כתוב את מחשבתך או שאלתך...",
    send: "שלח",
    thinking: "החברותא חושב...",
    newTopic: "נושא חדש",
    listening: "מקשיב...",
    micNotSupported: "הדפדפן לא תומך בהקלטה",
    errGeneric: "משהו השתבש. נסה שוב.",
    errRate: "הגעת למגבלת ההודעות לשעה. נסה שוב מאוחר יותר.",
  },
  en: {
    title: "Havruta AI",
    intro: "Choose a topic or text — a verse, a Mishnah, an article — and start a real study discussion. Your study partner will challenge, encourage, and go deeper with you.",
    topicPlaceholder: "e.g. Genesis ch. 1 verses 3–4, or: Berakhot 2a",
    startBtn: "Start learning",
    suggestions: [
      "Genesis ch. 1 verses 3–4",
      "Berakhot 2a — when do we recite Shema?",
      "The Ten Commandments — duty vs. prohibition",
      "What is the meaning of 'free will' in Judaism?",
    ],
    inputPlaceholder: "Write your thought or question...",
    send: "Send",
    thinking: "Your havruta is thinking...",
    newTopic: "New topic",
    listening: "Listening...",
    micNotSupported: "Your browser does not support speech input",
    errGeneric: "Something went wrong. Try again.",
    errRate: "You reached the hourly message limit. Try again later.",
  },
  es: {
    title: "Javruta AI",
    intro: "Elige un tema o texto — un versículo, una Mishná, un artículo — y comienza una verdadera discusión de estudio.",
    topicPlaceholder: "p. ej. Génesis cap. 1 versículos 3–4",
    startBtn: "Empezar a estudiar",
    suggestions: [
      "Génesis cap. 1 versículos 3–4",
      "Berajot 2a — ¿cuándo recitamos el Shemá?",
      "Los Diez Mandamientos — ¿deber o prohibición?",
      "¿Qué significa el 'libre albedrío' en el judaísmo?",
    ],
    inputPlaceholder: "Escribe tu idea o pregunta...",
    send: "Enviar",
    thinking: "Tu javruta está pensando...",
    newTopic: "Nuevo tema",
    listening: "Escuchando...",
    micNotSupported: "Tu navegador no admite entrada de voz",
    errGeneric: "Algo salió mal. Inténtalo de nuevo.",
    errRate: "Alcanzaste el límite de mensajes por hora.",
  },
  ar: {
    title: "حَبْروتا AI",
    intro: "اختر موضوعًا أو نصًا — آية، مِشناه، مقال — وابدأ نقاشًا تعليميًا حقيقيًا.",
    topicPlaceholder: "مثال: سفر التكوين الإصحاح 1 الآيات 3–4",
    startBtn: "ابدأ الدراسة",
    suggestions: [
      "سفر التكوين الإصحاح 1 الآيات 3–4",
      "براخوت 2أ — متى نقرأ شمע؟",
      "الوصايا العشر — واجب أم تحريم؟",
      "ما معنى 'الإرادة الحرة' في اليهودية؟",
    ],
    inputPlaceholder: "اكتب فكرتك أو سؤالك...",
    send: "إرسال",
    thinking: "شريكك يفكر...",
    newTopic: "موضوع جديد",
    listening: "أستمع...",
    micNotSupported: "متصفحك لا يدعم الإدخال الصوتي",
    errGeneric: "حدث خطأ ما. حاول مجددًا.",
    errRate: "وصلت إلى حد الرسائل في الساعة.",
  },
};

const SPEECH_LANG: Record<string, string> = {
  he: "he-IL",
  en: "en-US",
  es: "es-ES",
  ar: "ar-SA",
};

export function HavrutaChat({ locale }: { locale: string }) {
  const t = texts[locale] ?? texts.he;
  const [topic, setTopic] = useState("");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", text: content }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/havruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, messages: next, locale }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setError(t.errRate);
      } else if (json.reply) {
        setMessages([...next, { role: "model", text: json.reply }]);
      } else {
        setError(t.errGeneric);
      }
    } catch {
      setError(t.errGeneric);
    }
    setLoading(false);
  }

  function startListening() {
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
          onend: () => void;
          onerror: () => void;
          start: () => void;
          stop: () => void;
        })
      | undefined;
    if (!SR) {
      setError(t.micNotSupported);
      return;
    }
    const rec = new SR();
    rec.lang = SPEECH_LANG[locale] ?? "he-IL";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-8 shadow-sm">
          <div className="mb-2 text-4xl">📖</div>
          <h1 className="mb-3 text-3xl font-bold text-zinc-900">{t.title}</h1>
          <p className="mb-6 leading-relaxed text-zinc-600">{t.intro}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (topic.trim()) setStarted(true);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!topic.trim()}
              className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {t.startBtn}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {t.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setTopic(s);
                  setStarted(true);
                }}
                className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs text-zinc-700 hover:border-amber-400 hover:bg-amber-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-sm font-medium text-zinc-800">
          📖 <span className="font-bold">{t.title}</span> · {topic}
        </div>
        <button
          onClick={() => {
            setStarted(false);
            setMessages([]);
            setError(null);
          }}
          className="text-xs text-amber-700 hover:underline"
        >
          {t.newTopic}
        </button>
      </div>

      <div className="min-h-64 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {messages.length === 0 && !loading && (
          <p className="py-10 text-center text-sm text-zinc-400">{t.inputPlaceholder}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-tl-sm bg-zinc-100 text-zinc-800"
                  : "rounded-tr-sm bg-amber-600 text-white"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-sm bg-amber-100 px-4 py-3 text-sm text-amber-800">
              {t.thinking}
            </div>
          </div>
        )}
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t.inputPlaceholder}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={startListening}
          title={listening ? t.listening : undefined}
          className={`rounded-xl border px-3 py-3 text-lg ${
            listening
              ? "border-red-300 bg-red-50"
              : "border-zinc-300 bg-white hover:bg-zinc-50"
          }`}
        >
          {listening ? "🔴" : "🎤"}
        </button>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
