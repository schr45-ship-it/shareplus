"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Msg = { id?: string; role: "user" | "model"; text: string; author?: string; image?: string };
type SavedSession = { id: string; topic: string; updated: number };
type CommunitySession = { id: string; topic: string; locale: string; author_name: string | null; updated_at: string; parent_session_id?: string | null; is_locked?: boolean; messages: number };
type LinkedSession = { id: string; topic: string; author_name?: string | null; parent_session_id?: string | null };

const NAME_KEY = "havruta_name";
const OWNER_KEY = "havruta_owner_key";

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
    modes: { deep: string; pshat: string; commentators: string };
    fork: string;
    forkTitle: string;
    forkPrompt: string;
    forkBtn: string;
    forkedFrom: string;
    forks: string;
    tree: string;
    treeTitle: string;
    lock: string;
    unlock: string;
    errLocked: string;
    errNotOwner: string;
    login: string;
    logout: string;
    loginTitle: string;
    loginSub: string;
    loginGoogle: string;
    loginEmailPlaceholder: string;
    loginSend: string;
    loginSent: string;
    profile: string;
    publish: string;
    makePrivate: string;
    makePublic: string;
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
    modes: { deep: "למידה עמוקה", pshat: "פשט בלבד", commentators: "מפרשים" },
    fork: "התפצל מכאן",
    forkTitle: "הסתעפות מהדיון",
    forkPrompt: "מה הכיוון החדש? (אופציונלי)",
    forkBtn: "התחל הסתעפות",
    forkedFrom: "נצלב מ",
    forks: "הסתעפויות מהדיון",
    tree: "מפת דיון",
    treeTitle: "עץ הדיון",
    lock: "נעל מפני הסתעפויות",
    unlock: "פתח להסתעפויות",
    errLocked: "הדיון נעול — לא ניתן לפתוח ממנו הסתעפויות.",
    errNotOwner: "רק יוצר הדיון או מנהל יכולים לנעול אותו.",
    login: "התחבר",
    logout: "התנתק",
    loginTitle: "כניסה / הרשמה",
    loginSub: "כניסה שומרת את הדיונים שלך בכל מכשיר, ממלאת את שמך אוטומטית, ונותנת לך שליטה על דיונים שיצרת.",
    loginGoogle: "המשך עם Google",
    loginEmailPlaceholder: "המייל שלך — נשלח לינק כניסה",
    loginSend: "שלח לינק כניסה",
    loginSent: "נשלח! בדוק את המייל ולחץ על הלינק.",
    profile: "הפרופיל שלי",
    publish: "פרסם דיון בקהילה",
    makePrivate: "הפוך לפרטי (הסתר מהקהילה)",
    makePublic: "הפוך לציבורי (הצג בקהילה)",
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
    modes: { deep: "Deep learning", pshat: "Plain meaning only", commentators: "Commentators" },
    fork: "Branch from here",
    forkTitle: "Fork this discussion",
    forkPrompt: "What's the new direction? (optional)",
    forkBtn: "Start branch",
    forkedFrom: "Branched from",
    forks: "Branches from this discussion",
    tree: "Discussion map",
    treeTitle: "Discussion tree",
    lock: "Lock against forks",
    unlock: "Unlock for forks",
    errLocked: "This discussion is locked — no branches can be started from it.",
    errNotOwner: "Only the discussion creator or an admin can lock it.",
    login: "Sign in",
    logout: "Sign out",
    loginTitle: "Sign in / Register",
    loginSub: "Signing in syncs your discussions across devices, fills your name automatically, and lets you manage discussions you created.",
    loginGoogle: "Continue with Google",
    loginEmailPlaceholder: "Your email — we'll send a sign-in link",
    loginSend: "Send sign-in link",
    loginSent: "Sent! Check your email and click the link.",
    profile: "My profile",
    publish: "Publish discussion to community",
    makePrivate: "Make private (hide from community)",
    makePublic: "Make public (show in community)",
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
    modes: { deep: "Estudio profundo", pshat: "Solo sentido simple", commentators: "Comentaristas" },
    fork: "Ramificar desde aquí",
    forkTitle: "Ramificar esta discusión",
    forkPrompt: "¿Cuál es la nueva dirección? (opcional)",
    forkBtn: "Iniciar rama",
    forkedFrom: "Ramificado de",
    forks: "Ramas de esta discusión",
    tree: "Mapa de discusión",
    treeTitle: "Árbol de discusión",
    lock: "Bloquear ramificaciones",
    unlock: "Permitir ramificaciones",
    errLocked: "Esta discusión está bloqueada — no se pueden abrir ramas.",
    errNotOwner: "Solo el creador de la discusión o un administrador puede bloquearla.",
    login: "Iniciar sesión",
    logout: "Cerrar sesión",
    loginTitle: "Entrar / Registrarse",
    loginSub: "Al entrar, tus discusiones se sincronizan entre dispositivos, tu nombre se completa automáticamente y puedes gestionar tus discusiones.",
    loginGoogle: "Continuar con Google",
    loginEmailPlaceholder: "Tu email — te enviaremos un enlace",
    loginSend: "Enviar enlace de acceso",
    loginSent: "¡Enviado! Revisa tu email y haz clic en el enlace.",
    profile: "Mi perfil",
    publish: "Publicar discusión en la comunidad",
    makePrivate: "Hacer privada (ocultar de la comunidad)",
    makePublic: "Hacer pública (mostrar en la comunidad)",
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
    modes: { deep: "دراسة معمقة", pshat: "المعنى البسيط فقط", commentators: "المفسرون" },
    fork: "تفرّع من هنا",
    forkTitle: "تفريع هذا النقاش",
    forkPrompt: "ما الاتجاه الجديد؟ (اختياري)",
    forkBtn: "ابدأ التفريع",
    forkedFrom: "متفرع من",
    forks: "تفرعات هذا النقاش",
    tree: "خريطة النقاش",
    treeTitle: "شجرة النقاش",
    lock: "قفل ضد التفرعات",
    unlock: "فتح للتفرعات",
    errLocked: "هذا النقاش مقفل — لا يمكن فتح تفرعات منه.",
    errNotOwner: "فقط منشئ النقاش أو المشرف يمكنه قفله.",
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    loginTitle: "دخول / تسجيل",
    loginSub: "تسجيل الدخول يزامن نقاشاتك عبر الأجهزة، يملأ اسمك تلقائيًا، ويتيح لك إدارة نقاشاتك.",
    loginGoogle: "المتابعة مع Google",
    loginEmailPlaceholder: "بريدك الإلكتروني — سنرسل رابط دخول",
    loginSend: "أرسل رابط الدخول",
    loginSent: "تم الإرسال! تحقق من بريدك وانقر على الرابط.",
    profile: "ملفي الشخصي",
    publish: "انشر النقاش للمجتمع",
    makePrivate: "اجعله خاصًا (إخفاء من المجتمع)",
    makePublic: "اجعله عامًا (إظهار في المجتمع)",
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

// Light markdown: **bold**, *italic*
function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Block-level render: ## headers, bullets, numbered lists, paragraphs
function renderText(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} className="h-1.5" />;
    const h = t.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const cls = h[1].length === 1
        ? "text-base font-bold"
        : h[1].length === 2
          ? "text-[15px] font-bold"
          : "text-sm font-bold";
      return (
        <div key={i} className={`${cls} mt-1.5 opacity-95`}>
          {renderInline(h[2])}
        </div>
      );
    }
    const bullet = t.match(/^[-•*]\s+(.*)/);
    if (bullet) {
      return (
        <div key={i} className="flex gap-2 ps-1">
          <span className="shrink-0">•</span>
          <span className="flex-1">{renderInline(bullet[1])}</span>
        </div>
      );
    }
    const num = t.match(/^(\d+)[.)]\s+(.*)/);
    if (num) {
      return (
        <div key={i} className="flex gap-2 ps-1">
          <span className="shrink-0 font-semibold">{num[1]}.</span>
          <span className="flex-1">{renderInline(num[2])}</span>
        </div>
      );
    }
    return <div key={i}>{renderInline(t)}</div>;
  });
}

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<"deep" | "pshat" | "commentators">("deep");
  const [parent, setParent] = useState<LinkedSession | null>(null);
  const [children, setChildren] = useState<LinkedSession[]>([]);
  const [forkIdx, setForkIdx] = useState<number | null>(null);
  const [forkTopic, setForkTopic] = useState("");
  const [forkStartIdx, setForkStartIdx] = useState<number | null>(null);
  const [forkDir, setForkDir] = useState("");
  const [showTree, setShowTree] = useState(false);
  const [treeData, setTreeData] = useState<{ current: string; nodes: LinkedSession[] } | null>(null);
  const [ownerKey, setOwnerKey] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [lockBusy, setLockBusy] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setRecent(loadSaved(storageKey));
    try {
      setAuthorName(localStorage.getItem(NAME_KEY) ?? "");
      setIsAdmin(!!localStorage.getItem("admin_token"));
      let ok = localStorage.getItem(OWNER_KEY);
      if (!ok) {
        ok = crypto.randomUUID();
        localStorage.setItem(OWNER_KEY, ok);
      }
      setOwnerKey(ok);
    } catch {}
    fetch(`/api/havruta?list=recent&tool=${tool}`)
      .then((r) => r.json())
      .then((j) => setCommunity(Array.isArray(j.sessions) ? j.sessions : []))
      .catch(() => {});
    const shared = new URLSearchParams(window.location.search).get("s");
    if (shared && /^[0-9a-f-]{36}$/.test(shared)) resume(shared, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth: keep session state in sync (also auto-exchanges OAuth ?code= on redirect)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAccessToken(data.session?.access_token ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      setAccessToken(s?.access_token ?? "");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On login: fill author name from profile; load my discussions from server
  useEffect(() => {
    if (user) {
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "";
      if (name) {
        setAuthorName(name);
        try {
          localStorage.setItem(NAME_KEY, name);
        } catch {}
      }
    }
    if (!accessToken) return;
    fetch("/api/havruta?mine=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!Array.isArray(j.sessions)) return;
        const mine: SavedSession[] = j.sessions.map(
          (s: { id: string; topic: string; updated_at: string }) => ({
            id: s.id,
            topic: s.topic,
            updated: Date.parse(s.updated_at) || 0,
          }),
        );
        setRecent((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          const merged = [...prev];
          for (const s of mine) if (!seen.has(s.id)) merged.push(s);
          return merged;
        });
      })
      .catch(() => {});
  }, [user, accessToken]);

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
      const u = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ""));
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

  const adminTxt = {
    he: { del: "מחק דיון", confirmDel: "למחוק את הדיון לצמיתות?", edit: "ערוך הודעה", promptEdit: "ערוך את ההודעה:", save: "שמור", regen: "הפק תשובה מחדש" },
    en: { del: "Delete discussion", confirmDel: "Delete this discussion permanently?", edit: "Edit message", promptEdit: "Edit the message:", save: "Save", regen: "Regenerate reply" },
    es: { del: "Eliminar discusión", confirmDel: "¿Eliminar esta discusión permanentemente?", edit: "Editar mensaje", promptEdit: "Editar el mensaje:", save: "Guardar", regen: "Regenerar respuesta" },
    ar: { del: "حذف النقاش", confirmDel: "حذف هذا النقاش نهائيًا؟", edit: "تحرير الرسالة", promptEdit: "حرر الرسالة:", save: "حفظ", regen: "أعد توليد الرد" },
  }[locale] ?? { del: "Delete discussion", confirmDel: "Delete this discussion permanently?", edit: "Edit message", promptEdit: "Edit the message:", save: "Save", regen: "Regenerate reply" };

  function adminHeaders(): HeadersInit {
    try {
      const token = localStorage.getItem("admin_token") ?? "";
      return token ? { "x-admin-token": token } : {};
    } catch {
      return {};
    }
  }

  function authHeaders(): HeadersInit {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  function authRedirect(): string {
    const next = `${window.location.pathname}${window.location.search}`;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function signInGoogle() {
    setLoginBusy(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirect() },
      });
    } catch {}
    setLoginBusy(false);
  }

  async function sendMagicLink() {
    const email = magicEmail.trim();
    if (!email.includes("@") || loginBusy) return;
    setLoginBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authRedirect() },
      });
      if (!error) setMagicSent(true);
      else setError(t.errGeneric);
    } catch {
      setError(t.errGeneric);
    }
    setLoginBusy(false);
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setAccessToken("");
    setShowLogin(false);
  }

  // Lock/unlock this discussion against forks — owner (browser key) or admin
  // Toggle public/private visibility — owner or admin
  async function togglePrivacy() {
    if (!sessionId || lockBusy) return;
    setLockBusy(true);
    try {
      const res = await fetch("/api/havruta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeaders(), ...authHeaders() },
        body: JSON.stringify({ sessionId, isPublic: !isPublic, ownerKey }),
      });
      if (res.ok) {
        setIsPublic(!isPublic);
      } else {
        setError(res.status === 401 ? t.errNotOwner : t.errGeneric);
      }
    } catch {
      setError(t.errGeneric);
    }
    setLockBusy(false);
  }

  async function toggleLock() {
    if (!sessionId || lockBusy) return;
    setLockBusy(true);
    try {
      const res = await fetch("/api/havruta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeaders(), ...authHeaders() },
        body: JSON.stringify({ sessionId, locked: !isLocked, ownerKey }),
      });
      if (res.ok) {
        const next = !isLocked;
        setIsLocked(next);
        setCommunity((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, is_locked: next } : s)),
        );
      } else {
        setError(res.status === 401 ? t.errNotOwner : t.errGeneric);
      }
    } catch {
      setError(t.errGeneric);
    }
    setLockBusy(false);
  }

  async function deleteSession(sid: string) {
    if (!window.confirm(adminTxt.confirmDel)) return;
    try {
      const res = await fetch(`/api/havruta?session=${sid}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) return;
      setCommunity((prev) => prev.filter((s) => s.id !== sid));
      try {
        const list = loadSaved(storageKey).filter((s) => s.id !== sid);
        localStorage.setItem(storageKey, JSON.stringify(list));
        setRecent(list);
      } catch {}
      if (sessionId === sid) goHome();
    } catch {}
  }

  function openEdit(idx: number) {
    const m = messages[idx];
    if (!m?.id) return;
    setEditDraft(m.text);
    setEditingIdx(idx);
  }

  async function saveEdit() {
    const idx = editingIdx;
    const m = idx === null ? null : messages[idx];
    if (!m?.id || !editDraft.trim() || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch("/api/havruta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ id: m.id, content: editDraft.trim() }),
      });
      if (res.ok) {
        setMessages((prev) => prev.map((mm, i) => (i === idx ? { ...mm, text: editDraft.trim() } : mm)));
        setEditingIdx(null);
      }
    } catch {}
    setEditSaving(false);
  }

  // Fork: continue the discussion from message idx in a new direction
  function startFork(idx: number) {
    if (!sessionId) return;
    const direction = forkTopic.trim();
    const ctx = messages.slice(0, idx + 1);
    setMessages(ctx);
    setForkStartIdx(ctx.length);
    setForkDir(direction || topic);
    setParent({ id: sessionId, topic });
    setSessionId(null);
    setIsLocked(false);
    if (direction) setTopic(direction);
    setChildren([]);
    setForkIdx(null);
    setForkTopic("");
    setError(null);
    // If the fork point ends on a user message, the partner should answer it
    if (ctx[ctx.length - 1]?.role === "user") requestReply(ctx);
  }

  async function openTree() {
    if (!sessionId) return;
    setShowTree(true);
    setTreeData(null);
    try {
      const res = await fetch(`/api/havruta?tree=${sessionId}`);
      const json = await res.json();
      if (Array.isArray(json.nodes)) {
        setTreeData({ current: json.current, nodes: json.nodes });
      }
    } catch {}
  }

  function renderTreeNode(node: LinkedSession, depth: number): React.ReactNode {
    const kids = treeData?.nodes.filter((n) => n.parent_session_id === node.id) ?? [];
    const isCurrent = node.id === treeData?.current;
    return (
      <div key={node.id}>
        <button
          onClick={() => {
            setShowTree(false);
            if (!isCurrent) resume(node.id, node.topic);
          }}
          style={{ paddingInlineStart: depth * 20 }}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs ${
            isCurrent
              ? "bg-amber-100 font-bold text-amber-900"
              : "text-zinc-700 hover:bg-emerald-50"
          }`}
        >
          <span className={isCurrent ? "text-amber-600" : "text-emerald-500"}>
            {depth === 0 ? "🌳" : "🌿"}
          </span>
          <span className="truncate">{node.topic}</span>
          {node.author_name && (
            <span className="shrink-0 text-[10px] text-zinc-400">· {node.author_name}</span>
          )}
        </button>
        {kids.map((k) => renderTreeNode(k, depth + 1))}
      </div>
    );
  }

  // Admin: regenerate the model reply at idx using the conversation up to that point
  async function regenerate(idx: number) {
    const target = messages[idx];
    if (
      regenIdx !== null ||
      !target?.id ||
      target.role !== "model" ||
      messages[idx - 1]?.role !== "user" ||
      loading
    )
      return;
    setRegenIdx(idx);
    setError(null);
    try {
      const res = await fetch("/api/havruta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({
          topic,
          source,
          locale,
          tool,
          sessionId: sessionId ?? undefined,
          messages: messages.slice(0, idx),
          mode,
          regen: true,
          targetMessageId: target.id,
        }),
      });
      const json = await res.json();
      if (json.reply) {
        setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, text: json.reply } : m)));
      } else {
        setError(t.errGeneric);
      }
    } catch {
      setError(t.errGeneric);
    }
    setRegenIdx(null);
  }

  function goHome() {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    setSpeakingIdx(null);
    setStarted(false);
    setMessages([]);
    setError(null);
    setParent(null);
    setChildren([]);
    setForkStartIdx(null);
    setForkDir("");
    setIsLocked(false);
    setIsPublic(true);
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
    setParent(null);
    setChildren([]);
    setForkStartIdx(null);
    setForkDir("");
    setIsLocked(false);
    setIsPublic(true);
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
        if (["deep", "pshat", "commentators"].includes(json.session.study_mode)) {
          setMode(json.session.study_mode);
        }
        setIsLocked(!!json.session.is_locked);
        setIsPublic(json.session.is_public !== false);
        setParent(json.parent ?? null);
        setChildren(Array.isArray(json.children) ? json.children : []);
        setForkStartIdx(null);
        setForkDir("");
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
    recognitionRef.current?.stop();
    setListening(false);
    await requestReply(next);
  }

  async function requestReply(next: Msg[]) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/havruta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          topic,
          source,
          messages: next,
          locale,
          sessionId: sessionId ?? undefined,
          authorName: authorName.trim() || undefined,
          tool,
          mode,
          ownerKey,
          isPublic,
          parentSessionId: !sessionId && parent ? parent.id : undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setError(t.errRate);
      } else if (res.status === 403 && json.error === "locked") {
        setError(t.errLocked);
      } else if (json.reply) {
        const finalMsgs: Msg[] = [...next, { role: "model", text: json.reply }];
        const ids: (string | undefined)[] = Array.isArray(json.messageIds) ? json.messageIds : [];
        if (sessionId) {
          // Existing session — only the last user message and the reply were persisted
          if (ids[0]) finalMsgs[finalMsgs.length - 2].id = ids[0];
          if (ids[1]) finalMsgs[finalMsgs.length - 1].id = ids[1];
        } else {
          // New session — every message was persisted in order
          ids.forEach((id, i) => {
            if (id && finalMsgs[i]) finalMsgs[i].id = id;
          });
        }
        setMessages(finalMsgs);
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
    rec.continuous = false;
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

  const modeChips =
    tool === "havruta" ? (
      <div className="flex flex-wrap gap-2">
        {(["deep", "pshat", "commentators"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              mode === m
                ? "border-amber-500 bg-amber-100 text-amber-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-amber-300"
            }`}
          >
            {t.modes[m]}
          </button>
        ))}
      </div>
    ) : null;

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
            {modeChips}
            {tool !== "shadchan" && (
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
                />
                🌐 {t.publish}
              </label>
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

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-amber-100 pt-3 text-xs">
            {user ? (
              <>
                <span className="flex min-w-0 items-center gap-2 text-zinc-600">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={String(user.user_metadata.avatar_url)}
                      alt=""
                      className="h-5 w-5 shrink-0 rounded-full"
                    />
                  ) : (
                    <span>👤</span>
                  )}
                  <span className="truncate">
                    {authorName.trim() || user.email}
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    {t.login} ✓
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/${locale}/profile`}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {t.profile}
                  </a>
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-zinc-400 hover:text-red-600 hover:underline"
                  >
                    {t.logout}
                  </button>
                </span>
              </>
            ) : (
              <>
                <span className="truncate text-zinc-500">
                  {authorName.trim() ? `👤 ${t.loggedAs(authorName.trim())}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(true);
                    setMagicSent(false);
                  }}
                  className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                >
                  🔐 {t.login}
                </button>
              </>
            )}
          </div>

          {recent.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-zinc-500">{t.recent}</p>
              <div className="flex flex-wrap gap-2">
                {recent.map((s) => (
                  <div key={s.id} className="flex items-center">
                    <button
                      onClick={() => resume(s.id, s.topic)}
                      disabled={loading}
                      className="max-w-56 truncate rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-600 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                    >
                      💬 {s.topic}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => deleteSession(s.id)}
                        title={adminTxt.del}
                        className="-ms-2 rounded-full px-1 text-xs text-zinc-400 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tool !== "shadchan" && community.length > 0 && (
            <div className="mt-4 border-t border-amber-100 pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">{t.community}</p>
              <div className="space-y-1.5">
                {(() => {
                  const kids = (pid: string) =>
                    community.filter((c) => c.parent_session_id === pid);
                  const roots = community.filter(
                    (s) =>
                      !s.parent_session_id ||
                      !community.some((p) => p.id === s.parent_session_id),
                  );
                  const renderRow = (
                    s: CommunitySession,
                    depth: number,
                  ): React.ReactNode => (
                    <Fragment key={s.id}>
                      <div
                        className="flex items-center gap-1"
                        style={{ marginInlineStart: depth * 18 }}
                      >
                        {depth > 0 && (
                          <span className="shrink-0 text-xs text-emerald-400">↳</span>
                        )}
                        <button
                          onClick={() => setJoinPrompt(s)}
                          disabled={loading}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-start text-xs text-zinc-700 disabled:opacity-50 ${
                            depth === 0
                              ? "border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50"
                              : "border-emerald-100 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50"
                          }`}
                        >
                          <span className="truncate font-medium">
                            {s.is_locked ? "🔒" : depth > 0 || s.parent_session_id ? "🌿" : "💬"} {s.topic}
                          </span>
                          <span className="shrink-0 text-zinc-400">
                            {s.author_name || t.guest} · {s.messages} ✉
                          </span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => deleteSession(s.id)}
                            title={adminTxt.del}
                            className="shrink-0 rounded-lg border border-red-200 bg-white px-2 py-2 text-xs text-red-500 hover:bg-red-50"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      {kids(s.id).map((k) => renderRow(k, depth + 1))}
                    </Fragment>
                  );
                  return roots.map((s) => renderRow(s, 0));
                })()}
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

        {showLogin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowLogin(false);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-xl">
              <h3 className="mb-1 text-lg font-bold text-zinc-900">{t.loginTitle}</h3>
              <p className="mb-4 text-xs leading-relaxed text-zinc-500">{t.loginSub}</p>
              <button
                onClick={signInGoogle}
                disabled={loginBusy}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09a7.14 7.14 0 0 1 0-4.18v-2.9H2.18a11 11 0 0 0 0 9.88l3.66-2.8z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t.loginGoogle}
              </button>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-200" />
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
              {magicSent ? (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-xs font-medium text-emerald-700">
                  {t.loginSent}
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    dir="ltr"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendMagicLink();
                      }
                    }}
                    placeholder={t.loginEmailPlaceholder}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                  />
                  <button
                    onClick={sendMagicLink}
                    disabled={loginBusy || !magicEmail.includes("@")}
                    className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {t.loginSend}
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowLogin(false)}
                className="mt-4 w-full rounded-xl border border-zinc-200 px-4 py-2 text-xs text-zinc-500 hover:bg-zinc-50"
              >
                {t.back}
              </button>
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
          {isLocked ? " 🔒" : ""}
          {!isPublic ? " 🙈" : ""}
          {authorName.trim() ? ` · ${authorName.trim()}` : ""}
        </div>
        <div className="flex items-center gap-2">
          {sessionId && tool !== "shadchan" && (
            <button
              onClick={openTree}
              title={t.tree}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              🌳
            </button>
          )}
          {sessionId &&
            tool !== "shadchan" &&
            (isAdmin || recent.some((s) => s.id === sessionId)) && (
              <>
                <button
                  onClick={toggleLock}
                  disabled={lockBusy}
                  title={isLocked ? t.unlock : t.lock}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                    isLocked
                      ? "border-zinc-400 bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                      : "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {isLocked ? "🔒" : "🔓"}
                </button>
                <button
                  onClick={togglePrivacy}
                  disabled={lockBusy}
                  title={isPublic ? t.makePrivate : t.makePublic}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                    isPublic
                      ? "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                      : "border-zinc-400 bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                  }`}
                >
                  {isPublic ? "🌐" : "🙈"}
                </button>
              </>
            )}
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
          {isAdmin && sessionId && (
            <button
              onClick={() => deleteSession(sessionId)}
              title={adminTxt.del}
              className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {parent && (
        <button
          onClick={() => resume(parent.id, parent.topic)}
          className="mb-3 self-start rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-50"
        >
          🌿 {t.forkedFrom}: <span className="font-medium">{parent.topic}</span>
        </button>
      )}

      {modeChips && <div className="mb-3">{modeChips}</div>}

      <div className="min-h-64 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {messages.map((m, i) => (
          <Fragment key={i}>
          <div className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-tl-sm bg-zinc-100 text-zinc-800"
                  : "rounded-tr-sm bg-amber-500 text-white"
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
              {m.text !== "[image]" && renderText(m.text)}
              {m.text === "[image]" && !m.image && <span className="italic opacity-60">📷</span>}
              {m.text && m.text !== "[image]" && (
              <span className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speak(i, m.text)}
                  title={speakingIdx === i ? "⏹" : "🔊"}
                  className={`text-[11px] transition-opacity ${
                    m.role === "model" ? "text-amber-100" : "text-zinc-400"
                  } ${speakingIdx === i ? "opacity-100" : "opacity-50 hover:opacity-100"}`}
                >
                  {speakingIdx === i ? "⏹" : "🔊"}
                </button>
                {isAdmin && m.id && (
                  <button
                    type="button"
                    onClick={() => openEdit(i)}
                    title={adminTxt.edit}
                    className={`text-[11px] transition-opacity opacity-50 hover:opacity-100 ${
                      m.role === "model" ? "text-amber-100" : "text-zinc-400"
                    }`}
                  >
                    ✏️
                  </button>
                )}
                {isAdmin && m.id && m.role === "model" && messages[i - 1]?.role === "user" && (
                  <button
                    type="button"
                    onClick={() => regenerate(i)}
                    disabled={regenIdx === i}
                    title={adminTxt.regen}
                    className={`text-[11px] transition-opacity opacity-50 hover:opacity-100 text-amber-100 ${
                      regenIdx === i ? "animate-pulse opacity-100" : ""
                    }`}
                  >
                    {regenIdx === i ? "⏳" : "🔄"}
                  </button>
                )}
                {sessionId && tool !== "shadchan" && !isLocked && (
                  <button
                    type="button"
                    onClick={() => setForkIdx(i)}
                    title={t.fork}
                    className={`text-[11px] transition-opacity opacity-50 hover:opacity-100 ${
                      m.role === "model" ? "text-amber-100" : "text-zinc-400"
                    }`}
                  >
                    🌿
                  </button>
                )}
              </span>
              )}
            </div>
          </div>
          {forkStartIdx !== null && i + 1 === forkStartIdx && (
            <div className="py-1">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-emerald-200" />
                <span className="shrink-0 text-[11px] font-medium text-emerald-700">
                  🌿 {t.forkTitle}
                </span>
                <div className="h-px flex-1 bg-emerald-200" />
              </div>
              {forkDir && (
                <p className="mt-1 text-center text-[11px] font-medium text-emerald-600">
                  ⤵ {forkDir}
                </p>
              )}
            </div>
          )}
          </Fragment>
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

      {children.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">🌿 {t.forks}</p>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => resume(c.id, c.topic)}
                className="max-w-56 truncate rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs text-zinc-600 hover:border-emerald-400 hover:bg-emerald-50"
              >
                💬 {c.topic}
                {c.author_name ? ` · ${c.author_name}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

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
          title="📷"
          className="rounded-xl border-2 border-zinc-400 bg-white px-2 py-2 text-base text-zinc-700 shadow-sm transition hover:border-amber-500 hover:bg-amber-50 active:scale-95 sm:px-3 sm:py-2.5 sm:text-lg"
        >
          📷
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? t.listening : t.inputPlaceholder}
          rows={3}
          className={`flex-1 resize-none rounded-xl border-2 px-4 py-3 text-base shadow-sm focus:outline-none ${
            listening
              ? "border-red-400 bg-red-50 focus:border-red-500"
              : "border-zinc-400 focus:border-amber-500"
          }`}
        />
        <button
          type="button"
          onClick={startListening}
          title={listening ? t.listening : "🎤"}
          className={`rounded-xl border-2 px-2 py-2 text-base shadow-sm transition active:scale-95 sm:px-3 sm:py-2.5 sm:text-lg ${
            listening
              ? "border-red-400 bg-red-50 animate-pulse"
              : "border-zinc-400 bg-white hover:border-amber-500 hover:bg-amber-50"
          }`}
        >
          {listening ? "🔴" : "🎤"}
        </button>
        <button
          type="submit"
          disabled={loading || (!input.trim() && !pendingImage)}
          className="rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          {t.send}
        </button>
      </form>

      {showTree && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTree(false);
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-zinc-900">🌳 {t.treeTitle}</h3>
            <div className="flex-1 overflow-y-auto">
              {!treeData ? (
                <p className="py-6 text-center text-sm text-zinc-400">{t.thinking}</p>
              ) : (
                (() => {
                  const root =
                    treeData.nodes.find((n) => !n.parent_session_id) ?? treeData.nodes[0];
                  return root ? renderTreeNode(root, 0) : null;
                })()
              )}
            </div>
            <button
              onClick={() => setShowTree(false)}
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              {t.back}
            </button>
          </div>
        </div>
      )}

      {forkIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setForkIdx(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-bold text-zinc-900">🌿 {t.forkTitle}</h3>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              {t.forkPrompt}
            </p>
            <input
              autoFocus
              value={forkTopic}
              onChange={(e) => setForkTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  startFork(forkIdx);
                }
              }}
              placeholder={topic}
              className="mb-4 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => startFork(forkIdx)}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {t.forkBtn}
              </button>
              <button
                onClick={() => setForkIdx(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                {t.back}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingIdx(null);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-zinc-900">✏️ {adminTxt.edit}</h3>
            <textarea
              autoFocus
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={12}
              className="min-h-48 w-full flex-1 resize-y rounded-xl border border-zinc-300 px-4 py-3 text-sm leading-relaxed focus:border-amber-400 focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={saveEdit}
                disabled={editSaving || !editDraft.trim()}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                {adminTxt.save}
              </button>
              <button
                onClick={() => setEditingIdx(null)}
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
