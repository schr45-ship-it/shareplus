import { Metadata } from "next";
import { Profile } from "@/components/profile";

type Props = { params: Promise<{ locale: string }> };

const titles: Record<string, string> = {
  he: "הפרופיל שלי — SharePlus",
  en: "My profile — SharePlus",
  es: "Mi perfil — SharePlus",
  ar: "ملفي الشخصي — SharePlus",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: titles[locale] ?? titles.he,
    alternates: { canonical: `/${locale}/profile` },
    robots: { index: false },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <Profile locale={locale} />
    </div>
  );
}
