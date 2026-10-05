import { Metadata } from "next";

type Props = { params: Promise<{ locale: string }> };

const content: Record<string, { title: string; intro: string; emailLabel: string; note: string }> = {
  en: {
    title: "Contact Us",
    intro: "Have a question, feedback, or a business inquiry? We'd love to hear from you.",
    emailLabel: "Email",
    note: "We usually reply within 1–2 business days.",
  },
  he: {
    title: "צור קשר",
    intro: "יש לך שאלה, משוב או פנייה עסקית? נשמח לשמוע ממך.",
    emailLabel: "אימייל",
    note: "אנחנו בדרך כלל משיבים תוך יום–יומיים.",
  },
  es: {
    title: "Contacto",
    intro: "¿Tienes una pregunta, comentario o consulta comercial? Nos encantaría saber de ti.",
    emailLabel: "Correo electrónico",
    note: "Normalmente respondemos en 1–2 días laborables.",
  },
  ar: {
    title: "اتصل بنا",
    intro: "لديك سؤال أو ملاحظات أو استفسار تجاري؟ يسعدنا سماعك.",
    emailLabel: "البريد الإلكتروني",
    note: "نرد عادةً خلال 1-2 أيام عمل.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = content[locale] ?? content.en;
  return { title: c.title, alternates: { canonical: `/${locale}/contact` } };
}

export const revalidate = 86400;

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const c = content[locale] ?? content.en;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold text-zinc-900">{c.title}</h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">{c.intro}</p>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-zinc-500">{c.emailLabel}</div>
        <a
          href="mailto:contact@shareplus.news"
          className="text-lg font-medium text-blue-600 hover:underline"
        >
          contact@shareplus.news
        </a>
        <p className="mt-3 text-sm text-zinc-500">{c.note}</p>
      </div>
    </div>
  );
}
