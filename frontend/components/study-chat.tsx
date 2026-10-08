"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "model"; text: string; author?: string; image?: string };
type SavedSession = { id: string; topic: string; updated: number };
type CommunitySession = { id: string; topic: string; locale: string; author_name: string | null; updated_at: string; messages: number };

const NAME_KEY = "havruta_name";

export type StudyTool = "havruta" | "teacher" | "shadchan";

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
    backToTools: string;
    startInterview: string;
    loggedAs: (name: string) => string;
    greeting: (topic: string) => string;
    share: string;
    copyLink: string;
    embed: string;
    copied: string;
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
    recent: "הדיונים שלך",
    community: "דיונים אחרונים בקהילה",
    joinTitle: "איך קוראים לך?",
    joinBtn: "הצטרף לדיון",
    backToTools: "כל הכלי AI",
    startInterview: "התחל ראיון",
    loggedAs: (name) => `השם המחובר כרגע: ${name}`,
    share: "שתף דיון",
    copyLink: "העתק קישור",
    embed: "העתק קוד הטמעה",
    copied: "הועתק!",
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
    backToTools: "All AI tools",
    startInterview: "Start interview",
    loggedAs: (name) => `Currently logged in as: ${name}`,
    share: "Share discussion",
    copyLink: "Copy link",
    embed: "Copy embed code",
    copied: "Copied!",
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
    backToTools: "Todas las herramientas AI",
    startInterview: "Empezar entrevista",
    loggedAs: (name) => `Conectado como: ${name}`,
    share: "Compartir discusión",
    copyLink: "Copiar enlace",
    embed: "Copiar código de inserción",
    copied: "¡Copiado!",
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
    backToTools: "كل أدوات AI",
    startInterview: "ابدأ المقابلة",
    loggedAs: (name) => `الاسم الحالي: ${name}`,
    share: "مشاركة النقاش",
    copyLink: "نسخ الرابط",
    embed: "نسخ كود التضمين",
    copied: "تم النسخ!",
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

function loadSaved(key: string): SavedSession[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s) => s?.id && s?.topic) : [];
  } catch {
    return [];
  }
}

function saveSession(key: string, sid: string, topic: string) {
  try {
    const list = loadSaved(key).filter((s) => s.id !== sid);
    list.unshift({ id: sid, topic, updated: Date.now() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 10)));
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

const toolOverrides: Record<StudyTool, Partial<Record<string, Partial<(typeof texts)["he"]>>>> = {
  havruta: {},
  teacher: {
    he: {
      title: "המורה שלי AI",
      intro: "בחר מקצוע או נושא — מתמטיקה, פיזיקה, תכנות, היסטוריה — והמורה ילמד אותך צעד אחר צעד, יבחן ויעודד.",
      topicPlaceholder: "לדוגמה: מתמטיקה — פונקציות, או: פיזיקה — חוקי ניוטון",
      suggestions: [
        "מתמטיקה — פונקציות קוויות",
        "פיזיקה — חוקי ניוטון",
        "תכנות — משתנים ולולאות",
        "אנגלית — דקדוק בסיסי",
      ],
      community: "שיעורים אחרונים בקהילה",
      joinBtn: "הצטרף לשיעור",
      greeting: (topic) =>
        `שלום! אני המורה שלך 📚 בחרת ללמוד **${topic}**. מה הרמה שלך בנושא — מתחיל או מתקדם?`,
    },
    en: {
      title: "My Teacher AI",
      intro: "Choose a subject — math, physics, coding, history — and your teacher will guide you step by step, test and encourage you.",
      topicPlaceholder: "e.g. Math — linear functions, or: Physics — Newton's laws",
      suggestions: [
        "Math — linear functions",
        "Physics — Newton's laws",
        "Coding — variables and loops",
        "English — basic grammar",
      ],
      community: "Recent community lessons",
      joinBtn: "Join the lesson",
      greeting: (topic) =>
        `Hello! I'm your teacher 📚 You chose to learn **${topic}**. What's your level — beginner or advanced?`,
    },
    es: {
      title: "Mi Maestro AI",
      intro: "Elige una materia — matemáticas, física, programación, historia — y tu maestro te guiará paso a paso.",
      topicPlaceholder: "p. ej. Matemáticas — funciones lineales",
      suggestions: [
        "Matemáticas — funciones lineales",
        "Física — leyes de Newton",
        "Programación — variables y bucles",
        "Inglés — gramática básica",
      ],
      community: "Lecciones recientes de la comunidad",
      joinBtn: "Unirse a la lección",
      greeting: (topic) =>
        `¡Hola! Soy tu maestro 📚 Elegiste aprender **${topic}**. ¿Cuál es tu nivel — principiante o avanzado?`,
    },
    ar: {
      title: "معلّمي AI",
      intro: "اختر مادة — رياضيات، فيزياء، برمجة، تاريخ — وسيرشدك معلمك خطوة بخطوة.",
      topicPlaceholder: "مثال: رياضيات — دوال خطية",
      suggestions: [
        "رياضيات — دوال خطية",
        "فيزياء — قوانين نيوتن",
        "برمجة — متغيرات وحلقات",
        "إنجليزية — قواعد أساسية",
      ],
      community: "دروس المجتمع الأخيرة",
      joinBtn: "انضم إلى الدرس",
      greeting: (topic) =>
        `مرحبًا! أنا معلمك 📚 اخترت تعلم **${topic}**. ما مستواك — مبتدئ أم متقدم؟`,
    },
  },
  shadchan: {
    he: {
      title: "שדכן AI",
      intro: "שיחת היכרות אישית — השדכן ישאל אותך שאלות על אישיות, תחביבים, רקע, ערכים ומה אתה מחפש, ולבסוף יסכם לך פרופיל ורשימת בדיקות לצד השני.",
      inputPlaceholder: "ענה על שאלת השדכן...",
      greeting: (topic) =>
        `שלום! אני השדכן שלך 💞 נכיר אותך לעומק — אשאל שאלה אחת בכל פעם על אישיותך, תחביבים, רקע ומה אתה מחפש. נתחיל: ספר לי קצת על עצמך — מי אתה ומה חשוב לך בחיים?`,
    },
    en: {
      title: "Shadchan AI",
      intro: "A personal interview — the matchmaker asks about your personality, hobbies, background, values and what you're looking for, then summarizes your profile and what to check on the other side.",
      inputPlaceholder: "Answer the matchmaker's question...",
      greeting: () =>
        `Hello! I'm your shadchan 💞 I'll get to know you deeply — one question at a time about personality, hobbies, background and what you're looking for. Let's start: tell me a bit about yourself — who are you and what matters most in your life?`,
    },
    es: {
      title: "Shadchan AI",
      intro: "Una entrevista personal — el casamentero pregunta sobre tu personalidad, pasatiempos, valores y lo que buscas, y luego resume tu perfil y qué revisar del otro lado.",
      inputPlaceholder: "Responde la pregunta del casamentero...",
      greeting: () =>
        `¡Hola! Soy tu shadchan 💞 Te conoceré a fondo — una pregunta a la vez sobre tu personalidad, pasatiempos, trasfondo y lo que buscas. Empecemos: cuéntame un poco de ti — ¿quién eres y qué es lo más importante en tu vida?`,
    },
    ar: {
      title: "شادخان AI",
      intro: "مقابلة شخصية — الشادخان يسأل عن شخصيتك وهواياتك وخلفيتك وما تبحث عنه، ثم يلخص ملفك وما يجب فحصه في الطرف الآخر.",
      inputPlaceholder: "أجب على سؤال الشادخان...",
      greeting: () =>
        `مرحبًا! أنا الشادخان 💞 سأتعرف عليك بعمق — سؤال واحد في كل مرة عن شخصيتك وهواياتك وما تبحث عنه. لنبدأ: أخبرني قليلًا عن نفسك — من أنت وما الأهم في حياتك؟`,
    },
  },
};

export function StudyChat({ locale, tool = "havruta" }: { locale: string; tool?: StudyTool }) {
  const base = texts[locale] ?? texts.he;
  const t = { ...base, ...(toolOverrides[tool]?.[locale] ?? toolOverrides[tool]?.he ?? {}) };
  const storageKey = `study_sessions_${tool}`;
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
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setRecent(loadSaved(storageKey));
    try {
      setAuthorName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
    fetch(`/api/havruta?list=recent&tool=${tool}`)
      .then((r) => r.json())
      .then((j) => setCommunity(Array.isArray(j.sessions) ? j.sessions : []))
      .catch(() => {});
    const shared = new URLSearchParams(window.location.search).get("s");
    if (shared && /^[0-9a-f-]{36}$/.test(shared)) resume(shared, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    try {
      window.speechSynthesis?.cancel();
    } catch {}
  }, []);

  function speak(idx: number, text: string) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (speakingIdx === idx) {
        synth.cancel();
        setSpeakingIdx(null);
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = SPEECH_LANG[locale] ?? "he-IL";
      u.onend = () => setSpeakingIdx(null);
      u.onerror = () => setSpeakingIdx(null);
      setSpeakingIdx(idx);
      synth.speak(u);
    } catch {}
  }

  const pagePath = tool === "teacher" ? "teacher" : "havruta";
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/${pagePath}${sessionId ? `?s=${sessionId}` : ""}`
      : "";
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="650" style="border:1px solid #e5e7eb;border-radius:12px" loading="lazy"></iframe>`;

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {}
  }

  function goHome() {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    setSpeakingIdx(null);
    setStarted(false);
    setMessages([]);
    setError(null);
    setRecent(loadSaved(storageKey));
    fetch(`/api/havruta?list=recent&tool=${tool}`)
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

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPendingImage(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || loading) return;
    const next: Msg[] = [
      ...messages,
      {
        role: "user",
        text: content,
        author: authorName.trim() || undefined,
        image: pendingImage ?? undefined,
      },
    ];
    setMessages(next);
    setInput("");
    setPendingImage(null);
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
          tool,
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
        if (json.sessionId) saveSession(storageKey, json.sessionId, topic);
      } else {
        setError(t.errGeneric);
      }
    } catch {
      setError(t.errGeneric);
    }
    setLoading(false);
  }

  function startListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          continuous: boolean;
          onresult: (e: {
            results: ArrayLike<{ isFinal: boolean; length: number; [i: number]: { transcript: string } }>;
          }) => void;
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
    rec.interimResults = true;
    rec.continuous = true;
    const base = input ? `${input} ` : "";
    rec.onresult = (e) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r?.[0]?.transcript ?? "";
        if (r?.isFinal) finals += txt;
        else interim += txt;
      }
      setInput(base + finals + interim);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  const backArrow = locale === "he" || locale === "ar" ? "→" : "←";

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <a href={`/${locale}/tools`} className="text-xs text-amber-700 hover:underline">
            {backArrow} {t.backToTools}
          </a>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-8 shadow-sm">
          <div className="mb-2 text-4xl">{tool === "shadchan" ? "💞" : tool === "teacher" ? "🎓" : "📖"}</div>
          <h1 className="mb-3 text-3xl font-bold text-zinc-900">{t.title}</h1>
          <p className="mb-6 leading-relaxed text-zinc-600">{t.intro}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tool === "shadchan") {
                begin(`${t.title}${authorName.trim() ? ` — ${authorName.trim()}` : ""}`, "");
              } else if (topic.trim()) {
                begin(topic.trim(), source.trim());
              }
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
            {tool !== "shadchan" && (
              <>
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
              </>
            )}
            <button
              type="submit"
              disabled={(tool !== "shadchan" && !topic.trim()) || loading}
              className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {tool === "shadchan" ? t.startInterview : t.startBtn}
            </button>
          </form>

          {tool !== "shadchan" && (
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
          )}

          {authorName.trim() && (
            <p className="mt-5 border-t border-amber-100 pt-3 text-xs text-zinc-500">
              👤 {t.loggedAs(authorName.trim())}
            </p>
          )}

          {recent.length > 0 && (
            <div className={authorName.trim() ? "mt-3" : "mt-6 border-t border-amber-100 pt-4"}>
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

          {tool !== "shadchan" && community.length > 0 && (
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
      <div className="mb-3">
        <a href={`/${locale}/tools`} className="text-xs text-amber-700 hover:underline">
          {backArrow} {t.backToTools}
        </a>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          {locale === "he" || locale === "ar" ? "→" : "←"} {t.back}
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-medium text-zinc-800">
          {tool === "shadchan" ? "💞" : tool === "teacher" ? "🎓" : "📖"}{" "}
          <span className="font-bold">{t.title}</span> · {topic}
          {authorName.trim() ? ` · ${authorName.trim()}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowShare((v) => !v)}
              title={t.share}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              ⤴ {t.share}
            </button>
            {showShare && (
              <div className="absolute end-0 top-full z-30 mt-1 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`💬 ${topic}\n${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg px-3 py-2 text-xs text-zinc-700 hover:bg-amber-50"
                >
                  🟢 WhatsApp
                </a>
                <button
                  onClick={() => copyText(shareUrl, "link")}
                  className="block w-full rounded-lg px-3 py-2 text-start text-xs text-zinc-700 hover:bg-amber-50"
                >
                  {copied === "link" ? `✅ ${t.copied}` : `🔗 ${t.copyLink}`}
                </button>
                <button
                  onClick={() => copyText(embedCode, "embed")}
                  className="block w-full rounded-lg px-3 py-2 text-start text-xs text-zinc-700 hover:bg-amber-50"
                >
                  {copied === "embed" ? `✅ ${t.copied}` : `📐 ${t.embed}`}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={goHome}
            className="text-xs text-amber-700 hover:underline"
          >
            {t.newTopic}
          </button>
        </div>
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
              {m.image && (
                <img
                  src={m.image}
                  alt=""
                  className="mb-2 max-h-56 w-auto rounded-lg border border-black/10"
                />
              )}
              {m.text !== "[image]" && m.text}
              {m.text === "[image]" && !m.image && <span className="italic opacity-60">📷</span>}
              {m.text && m.text !== "[image]" && (
              <button
                type="button"
                onClick={() => speak(i, m.text)}
                title={speakingIdx === i ? "⏹" : "🔊"}
                className={`mt-1.5 block text-[11px] transition-opacity ${
                  m.role === "model" ? "text-amber-100" : "text-zinc-400"
                } ${speakingIdx === i ? "opacity-100" : "opacity-50 hover:opacity-100"}`}
              >
                {speakingIdx === i ? "⏹" : "🔊"}
              </button>
              )}
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

      {pendingImage && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative">
            <img src={pendingImage} alt="" className="h-16 w-16 rounded-lg border border-zinc-200 object-cover" />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-white hover:bg-zinc-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-lg hover:bg-zinc-50"
        >
          📷
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={listening ? t.listening : t.inputPlaceholder}
          rows={2}
          className={`flex-1 resize-none rounded-xl border px-4 py-3 text-sm focus:outline-none ${
            listening
              ? "border-red-400 bg-red-50 focus:border-red-500"
              : "border-zinc-300 focus:border-amber-400"
          }`}
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
          disabled={loading || (!input.trim() && !pendingImage)}
          className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
