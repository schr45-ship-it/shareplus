import { getTranslations } from "next-intl/server";
import { getLatestArticles } from "@/lib/supabase/queries";
import { ArticleCard } from "@/components/article-card";
import { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
    },
  };
}

export const revalidate = 3600;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const articles = await getLatestArticles(locale, { limit: 24 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900">
        {t("latest")}
      </h1>
      <p className="mb-8 text-zinc-600">
        AI summaries from around the web, translated for you.
      </p>

      {articles.length === 0 ? (
        <p className="text-zinc-500">{t("noResults")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.article_id} article={article} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
