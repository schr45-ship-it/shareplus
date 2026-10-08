import { Metadata } from "next";
import Link from "next/link";

type Props = { params: Promise<{ locale: string }> };

const texts: Record<
  string,
  {
    title: string;
    subtitle: string;
    comingSoon: string;
    tools: { name: string; desc: string; href: string; icon: string; live: boolean }[];
  }
> = {
  he: {
    title: "כלי AI",
    subtitle: "כלים חכמים מבוססי בינה מלאכותית — לימוד, חשיבה ומשחק.",
    comingSoon: "בקרוב",
    tools: [
      {
        name: "חברותא AI",
        desc: "שותף ללימוד יהודי: בחר נושא או טקסט, והחברותא יקשה, יעודד ויעמיק איתך.",
        href: "/he/havruta",
        icon: "📖",
        live: true,
      },
      {
        name: "המורה שלי AI",
        desc: "מורה פרטי בכל מקצוע: מתמטיקה, פיזיקה, תכנות ועוד — צעד אחר צעד, ברמה שלך.",
        href: "/he/teacher",
        icon: "🎓",
        live: true,
      },
      {
        name: "שדכן AI",
        desc: "מנתח את האישיות שלך, מברר מה אתה מחפש, ומסכם מה לבדוק בצד השני: תחביבים, רקע, ערכים ושאיפות.",
        href: "/he/shadchan",
        icon: "💞",
        live: true,
      },
    ],
  },
  en: {
    title: "AI Tools",
    subtitle: "Smart AI-powered tools — learning, thinking, and play.",
    comingSoon: "Coming soon",
    tools: [
      {
        name: "Havruta AI",
        desc: "A Jewish study partner: pick a topic or text and dive into a real discussion.",
        href: "/en/havruta",
        icon: "📖",
        live: true,
      },
      {
        name: "My Teacher AI",
        desc: "A private tutor in any subject — math, physics, coding — at your own pace.",
        href: "/en/teacher",
        icon: "🎓",
        live: true,
      },
      {
        name: "Shadchan AI",
        desc: "Analyzes your personality, clarifies what you're looking for, and summarizes what to check on the other side.",
        href: "/en/shadchan",
        icon: "💞",
        live: true,
      },
    ],
  },
  es: {
    title: "Herramientas AI",
    subtitle: "Herramientas inteligentes basadas en IA — aprendizaje, reflexión y juego.",
    comingSoon: "Próximamente",
    tools: [
      {
        name: "Javruta AI",
        desc: "Un compañero de estudio judío: elige un tema o texto y profundiza en una verdadera discusión.",
        href: "/es/havruta",
        icon: "📖",
        live: true,
      },
      {
        name: "Mi Maestro AI",
        desc: "Un tutor privado en cualquier materia, a tu propio ritmo.",
        href: "/es/teacher",
        icon: "🎓",
        live: true,
      },
      {
        name: "Shadchan AI",
        desc: "Analiza tu personalidad, aclara lo que buscas y resume qué revisar del otro lado.",
        href: "/es/shadchan",
        icon: "💞",
        live: true,
      },
    ],
  },
  ar: {
    title: "أدوات AI",
    subtitle: "أدوات ذكية تعمل بالذكاء الاصطناعي — تعلم وتفكير ولعب.",
    comingSoon: "قريبًا",
    tools: [
      {
        name: "حبروتا AI",
        desc: "شريك دراسة يهودي: اختر موضوعًا أو نصًا وابدأ نقاشًا حقيقيًا.",
        href: "/ar/havruta",
        icon: "📖",
        live: true,
      },
      {
        name: "معلّمي AI",
        desc: "معلم خاص في أي مادة — رياضيات، فيزياء، برمجة — بوتيرتك الخاصة.",
        href: "/ar/teacher",
        icon: "🎓",
        live: true,
      },
      {
        name: "شادخان AI",
        desc: "يحلل شخصيتك، يوضح ما تبحث عنه، ويلخص ما يجب فحصه في الطرف الآخر.",
        href: "/ar/shadchan",
        icon: "💞",
        live: true,
      },
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = texts[locale] ?? texts.he;
  return {
    title: `${t.title} — SharePlus`,
    alternates: { canonical: `/${locale}/tools` },
  };
}

export default async function ToolsPage({ params }: Props) {
  const { locale } = await params;
  const t = texts[locale] ?? texts.he;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mb-2 text-4xl">🤖</div>
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">{t.title}</h1>
        <p className="text-zinc-600">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {t.tools.map((tool) =>
          tool.live ? (
            <Link
              key={tool.name}
              href={tool.href}
              className="group rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm transition hover:border-amber-400 hover:shadow-md"
            >
              <div className="mb-2 text-3xl">{tool.icon}</div>
              <h2 className="mb-1 text-lg font-bold text-zinc-900 group-hover:text-amber-700">
                {tool.name}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600">{tool.desc}</p>
            </Link>
          ) : (
            <div
              key={tool.name}
              className="relative rounded-2xl border border-zinc-200 bg-zinc-50 p-6 opacity-70"
            >
              <span className="absolute end-4 top-4 rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600">
                {t.comingSoon}
              </span>
              <div className="mb-2 text-3xl grayscale">{tool.icon}</div>
              <h2 className="mb-1 text-lg font-bold text-zinc-700">{tool.name}</h2>
              <p className="text-sm leading-relaxed text-zinc-500">{tool.desc}</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
