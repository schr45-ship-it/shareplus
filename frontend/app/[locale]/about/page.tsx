import { Metadata } from "next";

type Props = { params: Promise<{ locale: string }> };

const content: Record<string, { title: string; intro: string; points: string[]; how: string; steps: string[] }> = {
  en: {
    title: "About SharePlus",
    intro:
      "SharePlus is an AI-powered news and video summary platform. We monitor leading news outlets and YouTube channels around the world, and turn each story into a clear, concise summary — translated into four languages.",
    points: [
      "Concise AI summaries of news articles and videos",
      "Every story available in English, Hebrew, Spanish and Arabic",
      "Key takeaways so you get the point in seconds",
      "Fresh content added automatically, around the clock",
    ],
    how: "How it works",
    steps: [
      "Our system continuously collects articles and videos from trusted sources",
      "An AI model summarizes each item and extracts the key takeaways",
      "The summary is translated and published in all four languages instantly",
    ],
  },
  he: {
    title: "אודות SharePlus",
    intro:
      "SharePlus היא פלטפורמת סיכומי חדשות וסרטונים מבוססת AI. אנחנו עוקבים אחרי מקורות החדשות והערוצים המובילים בעולם, והופכים כל סיפור לסיכום ברור ותמציתי — מתורגם לארבע שפות.",
    points: [
      "סיכומי AI תמציתיים של כתבות וסרטונים",
      "כל סיפור זמין באנגלית, עברית, ספרדית וערבית",
      "נקודות מפתח שמאפשרות להבין את העיקר בשניות",
      "תוכן חדש מתווסף אוטומטית, מסביב לשעון",
    ],
    how: "איך זה עובד",
    steps: [
      "המערכת אוספת ברציפות כתבות וסרטונים ממקורות מהימנים",
      "מודל AI מסכם כל פריט ומחלץ את נקודות המפתח",
      "הסיכום מתורגם ומתפרסם בארבע השפות באופן מיידי",
    ],
  },
  es: {
    title: "Acerca de SharePlus",
    intro:
      "SharePlus es una plataforma de resúmenes de noticias y vídeos impulsada por IA. Seguimos los principales medios y canales de YouTube del mundo y convertimos cada historia en un resumen claro y conciso, traducido a cuatro idiomas.",
    points: [
      "Resúmenes concisos de noticias y vídeos generados por IA",
      "Cada historia disponible en inglés, hebreo, español y árabe",
      "Puntos clave para captar lo esencial en segundos",
      "Contenido nuevo añadido automáticamente, las 24 horas",
    ],
    how: "Cómo funciona",
    steps: [
      "Nuestro sistema recopila artículos y vídeos de fuentes confiables",
      "Un modelo de IA resume cada elemento y extrae los puntos clave",
      "El resumen se traduce y publica en los cuatro idiomas al instante",
    ],
  },
  ar: {
    title: "حول SharePlus",
    intro:
      "SharePlus هي منصة ملخصات أخبار وفيديوهات مدعومة بالذكاء الاصطناعي. نتابع أهم مصادر الأخبار وقنوات يوتيوب حول العالم، ونحوّل كل قصة إلى ملخص واضح وموجز — مترجم إلى أربع لغات.",
    points: [
      "ملخصات موجزة للأخبار والفيديوهات بالذكاء الاصطناعي",
      "كل قصة متوفرة بالإنجليزية والعبرية والإسبانية والعربية",
      "نقاط رئيسية تتيح لك فهم الجوهر في ثوانٍ",
      "محتوى جديد يُضاف تلقائيًا على مدار الساعة",
    ],
    how: "كيف يعمل",
    steps: [
      "يجمع نظامنا المقالات والفيديوهات باستمرار من مصادر موثوقة",
      "يلخص نموذج ذكاء اصطناعي كل عنصر ويستخرج النقاط الرئيسية",
      "يُترجم الملخص ويُنشر فورًا باللغات الأربع",
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = content[locale] ?? content.en;
  return { title: c.title, alternates: { canonical: `/${locale}/about` } };
}

export const revalidate = 86400;

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const c = content[locale] ?? content.en;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold text-zinc-900">{c.title}</h1>
      <p className="mb-6 text-lg leading-relaxed text-zinc-600">{c.intro}</p>
      <ul className="mb-8 space-y-2">
        {c.points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-zinc-700">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
            {p}
          </li>
        ))}
      </ul>
      <h2 className="mb-3 text-xl font-semibold text-zinc-900">{c.how}</h2>
      <ol className="space-y-2">
        {c.steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3 text-zinc-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
