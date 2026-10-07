import { Metadata } from "next";
import { HavrutaChat } from "@/components/havruta-chat";

type Props = { params: Promise<{ locale: string }> };

const titles: Record<string, string> = {
  he: "חברותא AI — לימוד משותף עם בינה מלאכותית",
  en: "Havruta AI — study together with AI",
  es: "Javruta AI — estudia junto con IA",
  ar: "حبروتا AI — تعلم مع الذكاء الاصطناعي",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: titles[locale] ?? titles.he,
    alternates: { canonical: `/${locale}/havruta` },
  };
}

export default async function HavrutaPage({ params }: Props) {
  const { locale } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <HavrutaChat locale={locale} />
    </div>
  );
}
