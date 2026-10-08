import { Metadata } from "next";
import { StudyChat } from "@/components/study-chat";

type Props = { params: Promise<{ locale: string }> };

const titles: Record<string, string> = {
  he: "המורה שלי AI — מורה פרטי בכל מקצוע",
  en: "My Teacher AI — a private tutor in any subject",
  es: "Mi Maestro AI — un tutor privado en cualquier materia",
  ar: "معلّمي AI — معلم خاص في أي مادة",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: titles[locale] ?? titles.he,
    alternates: { canonical: `/${locale}/teacher` },
  };
}

export default async function TeacherPage({ params }: Props) {
  const { locale } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <StudyChat locale={locale} tool="teacher" />
    </div>
  );
}
