import { Metadata } from "next";
import { StudyChat } from "@/components/study-chat";

type Props = { params: Promise<{ locale: string }> };

const titles: Record<string, string> = {
  he: "שדכן AI — ראיון אישיות והכוונה לשידוך",
  en: "Shadchan AI — personality interview and matchmaking guidance",
  es: "Shadchan AI — entrevista de personalidad y guía de pareja",
  ar: "شادخان AI — مقابلة شخصية وتوجيه للزواج",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: titles[locale] ?? titles.he,
    alternates: { canonical: `/${locale}/shadchan` },
  };
}

export default async function ShadchanPage({ params }: Props) {
  const { locale } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <StudyChat locale={locale} tool="shadchan" />
    </div>
  );
}
