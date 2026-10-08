"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "model"; text: string; author?: string };
type SavedSession = { id: string; topic: string; updated: number };
type CommunitySession = { id: string; topic: string; locale: string; author_name: string | null; updated_at: string; messages: number };

const STORAGE_KEY = "havruta_sessions";
const NAME_KEY = "havruta_name";

const texts: Record<
  string,
  {
    title: string;
    intro: string;
    topicPlaceholder: string;
    sourceLabel: string;
    sourcePlaceholder: string;
    namePlaceholder: string;
    guest: string;
    startBtn: string;
    suggestions: string[];
    inputPlaceholder: string;
    send: string;
    thinking: string;
    newTopic: string;
    back: string;
    listening: string;
    micNotSupported: string;
    errGeneric: string;
    errRate: string;
    recent: string;
    community: string;
    joinTitle: string;
    joinBtn: string;
    greeting: (topic: string) => string;
  }
> = {
  he: {
    title: "חברותא AI",
    intro: "בחר נושא או טקסט — פסוק, משנה, מאמר — והתחל דיון לימודי אמיתי. החברותא יקשה, יעודד ויעמיק איתך.",
    topicPlaceholder: "לדוגמה: בראשית פרק א׳ פסוקים ג׳–ד׳, או: מסכת ברכות דף ב׳",
    sourceLabel: "מקור / טקסט (לא חובה)",
    sourcePlaceholder: "אפשר להדביק כאן את הטקסט שרוצים ללמוד — פסוקים, מקורות, או קטע ממאמר...",
    namePlaceholder: "איך קוראים לך? (יופיע בדיון)",
    guest: "אורח",
    startBtn: "התחל לימוד",
    suggestions: [
      "בראשית פרק א׳ פסוקים ג׳–ד׳",
      "מסכת ברכות דף ב׳ — ממתי קורין את שמע",
      "עשרת הדיברות — מה ההבדל בין חובה לאיסור?",
    ],
    inputPlaceholder: "כתוב את מחשבתך או שאלתך...",
    send: "שלח",
    thinking: "החברותא חושב...",
    newTopic: "נושא חדש",
    back: "חזרה",
    listening: "מקשיב...",
    micNotSupported: "הדפדפן לא תומך בהקלטה",
    errGeneric: "משהו השתבש. נסה שוב.",
    errRate: "הגעת למגבלת ההודעות לשעה. נסה שוב מאוחר יותר.",
    recent: "הדיונים שלי",
    community: "דיונים אחרונים בקהילה",
    joinTitle: "איך קוראים לך?",
    joinBtn: "הצטרף לדיון",
    greeting: (topic) =>
      `שלום! אני החברותא שלך 📖 בחרת ללמוד על **${topic}**. איך תרצה שנתחיל את הלימוד?`,
  },
  en: {
    title: "Havruta AI",
    intro: "Choose a topic or text — a verse, a Mishnah, an article — and start a real study discussion. Your study partner will challenge, encourage, and go deeper with you.",
    topicPlaceholder: "e.g. Genesis ch. 1 verses 3–4, or: Berakhot 2a",
    sourceLabel: "Source text (optional)",
    sourcePlaceholder: "You can paste the text you want to study — verses, sources, or a passage from an article...",
    namePlaceholder: "What's your name? (shown in the discussion)",
    guest: "Guest",
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
    back: "Back",
    listening: "Listening...",
    micNotSupported: "Your browser does not support speech input",
    errGeneric: "Something went wrong. Try again.",
    errRate: "You reached the hourly message limit. Try again later.",
    recent: "My discussions",
    community: "Recent community discussions",
    joinTitle: "What's your name?",
    joinBtn: "Join the discussion",
    greeting: (topic) =>
      `Shalom! I'm your havruta 📖 You chose to study **${topic}**. How would you like to begin?`,
  },
  es: {
    title: "Javruta AI",
    intro: "Elige un tema o texto — un versículo, una Mishná, un artículo — y comienza una verdadera discusión de estudio.",
    topicPlaceholder: "p. ej. Génesis cap. 1 versículos 3–4",
    sourceLabel: "Texto fuente (opcional)",
    sourcePlaceholder: "Puedes pegar aquí el texto que quieres estudiar...",
    namePlaceholder: "¿Cómo te llamas? (aparecerá en la discusión)",
    guest: "Invitado",
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
    back: "Volver",
    listening: "Escuchando...",
    micNotSupported: "Tu navegador no admite entrada de voz",
    errGeneric: "Algo salió mal. Inténtalo de nuevo.",
    errRate: "Alcanzaste el límite de mensajes por hora.",
    recent: "Mis discusiones",
    community: "Discusiones recientes de la comunidad",
    joinTitle: "¿Cómo te llamas?",
    joinBtn: "Unirse a la discusión",
    greeting: (topic) =>
      `¡Shalom! Soy tu javruta 📖 Elegiste estudiar **${topic}**. ¿Cómo quieres comenzar?`,
  },
  ar: {
    title: "حَبْروتا AI",
    intro: "اختر موضوعًا أو نصًا — آية، مِشناه، مقال — وابدأ نقاشًا تعليميًا حقيقيًا.",
    topicPlaceholder: "مثال: سفر التكوين الإصحاح 1 الآيات 3–4",
    sourceLabel: "النص المصدر (اختياري)",
    sourcePlaceholder: "يمكنك لصق النص الذي تريد دراسته هنا...",
    namePlaceholder: "ما اسمك؟ (سيظهر في النقاش)",
    guest: "ضيف",
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
    back: "رجوع",
    listening: "أستمع...",
    micNotSupported: "متصفحك لا يدعم الإدخال الصوتي",
    errGeneric: "حدث خطأ ما. حاول مجددًا.",
    errRate: "وصلت إلى حد الرسائل في الساعة.",
    recent: "نقاشاتي",
    community: "نقاشات المجتمع الأخيرة",
    joinTitle: "ما اسمك؟",
    joinBtn: "انضم إلى النقاش",
    greeting: (topic) =>
      `شالوم! أنا شريكك في الدراسة 📖 اخترت دراسة **${topic}**. كيف تريد أن نبدأ؟`,
  },
};

const SPEECH_LANG: Record<string, string> = {
  he: "he-IL",
  en: "en-US",
  es: "es-ES",
  ar: "ar-SA",
};

function loadSaved(): SavedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s) => s?.id && s?.topic) : [];
  } catch {
    return [];
  }
}

function saveSession(sid: string, topic: string) {
  try {
    const list = loadSaved().filter((s) => s.id !== sid);
    list.unshift({ id: sid, topic, updated: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

// WhatsApp-style: consistent color per participant name
const AUTHOR_COLORS = [
  "text-emerald-600",
  "text-sky-600",
  "text-rose-600",
  "text-violet-600",
  "text-orange-600",
  "text-teal-600",
  "text-pink-600",
  "text-indigo-600",
];

function authorColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

export function HavrutaChat({ locale }: { locale: string }) {
  const t = texts[locale] ?? texts.he;
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [recent, setRecent] = useState<SavedSession[]>([]);
  const [community, setCommunity] = useState<CommunitySession[]>([]);
  const [joinPrompt, setJoinPrompt] = useState<CommunitySession | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setRecent(loadSaved());
    try {
      setAuthorName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
    fetch("/api/havruta?list=recent")
      .then((r) => r.json())
      .then((j) => setCommunity(Array.isArray(j.sessions) ? j.sessions : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function goHome() {
    setStarted(false);
    setMessages([]);
    setError(null);
    setRecent(loadSaved());
    fetch("/api/havruta?list=recent")
      .then((r) => r.json())
      .then((j) => setCommunity(Array.isArray(j.sessions) ? j.sessions : []))
      .catch(() => {});
  }

  function begin(topicText: string, sourceText: string) {
    setTopic(topicText);
    setSource(sourceText);
    setSessionId(null);
    setMessages([{ role: "model", text: t.greeting(topicText) }]);
    setStarted(true);
    setError(null);
  }

  async function resume(sid: string, sTopic: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/havruta?session=${sid}`);
      const json = await res.json();
      if (json.session) {
        setTopic(json.session.topic || sTopic);
        setSource(json.session.source_text || "");
        if (json.session.author_name) setAuthorName(json.session.author_name);
        setSessionId(sid);
        setMessages(
          Array.isArray(json.messages) && json.messages.length
            ? json.messages
            : [{ role: "model", text: t.greeting(json.session.topic || sTopic) }],
        );
        setStarted(true);
      } else {
        setError(t.errGeneric);
      }
    } catch {
      setError(t.errGeneric);
    }
    setLoading(false);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: Msg[] = [
      ...messages,
      { role: "user", text: content, author: authorName.trim() || undefined },
    ];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/havruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          source,
          messages: next,
          locale,
          sessionId: sessionId ?? undefined,
          authorName: authorName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setError(t.errRate);
      } else if (json.reply) {
        setMessages([...next, { role: "model", text: json.reply }]);
        if (json.sessionId && json.sessionId !== sessionId) {
          setSessionId(json.sessionId);
        }
        if (json.sessionId) saveSession(json.sessionId, topic);
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
              if (topic.trim()) begin(topic.trim(), source.trim());
            }}
            className="flex flex-col gap-3"
          >
            <input
              value={authorName}
              onChange={(e) => {
                setAuthorName(e.target.value);
                try {
                  localStorage.setItem(NAME_KEY, e.target.value);
                } catch {}
              }}
              placeholder={t.namePlaceholder}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
            />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                {t.sourceLabel}
              </label>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t.sourcePlaceholder}
                rows={3}
                className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!topic.trim() || loading}
              className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {t.startBtn}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {t.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => begin(s, "")}
                className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs text-zinc-700 hover:border-amber-400 hover:bg-amber-50"
              >
                {s}
              </button>
            ))}
          </div>

          {recent.length > 0 && (
            <div className="mt-6 border-t border-amber-100 pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">{t.recent}</p>
              <div className="flex flex-wrap gap-2">
                {recent.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => resume(s.id, s.topic)}
                    disabled={loading}
                    className="max-w-56 truncate rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-600 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                  >
                    💬 {s.topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {community.length > 0 && (
            <div className="mt-4 border-t border-amber-100 pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">{t.community}</p>
              <div className="space-y-2">
                {community.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setJoinPrompt(s)}
                    disabled={loading}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-start text-xs text-zinc-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <span className="truncate font-medium">💬 {s.topic}</span>
                    <span className="shrink-0 text-zinc-400">
                      {s.author_name || t.guest} · {s.messages} ✉
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {joinPrompt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setJoinPrompt(null);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-xl">
              <h3 className="mb-1 text-lg font-bold text-zinc-900">{t.joinTitle}</h3>
              <p className="mb-4 truncate text-xs text-zinc-500">
                💬 {joinPrompt.topic}
              </p>
              <input
                autoFocus
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value);
                  try {
                    localStorage.setItem(NAME_KEY, e.target.value);
                  } catch {}
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    resume(joinPrompt.id, joinPrompt.topic);
                    setJoinPrompt(null);
                  }
                }}
                placeholder={t.namePlaceholder}
                className="mb-4 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    resume(joinPrompt.id, joinPrompt.topic);
                    setJoinPrompt(null);
                  }}
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  {t.joinBtn}
                </button>
                <button
                  onClick={() => setJoinPrompt(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  {t.back}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          {locale === "he" || locale === "ar" ? "→" : "←"} {t.back}
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-medium text-zinc-800">
          📖 <span className="font-bold">{t.title}</span> · {topic}
          {authorName.trim() ? ` · ${authorName.trim()}` : ""}
        </div>
        <button
          onClick={goHome}
          className="text-xs text-amber-700 hover:underline"
        >
          {t.newTopic}
        </button>
      </div>

      <div className="min-h-64 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-tl-sm bg-zinc-100 text-zinc-800"
                  : "rounded-tr-sm bg-amber-600 text-white"
              }`}
            >
              {m.role === "user" && (
                <div className={`mb-1 text-[11px] font-bold ${authorColor(m.author || t.guest)}`}>
                  {m.author || t.guest}
                </div>
              )}
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
