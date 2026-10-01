import { getTranslations } from "next-intl/server";
import { searchArticles } from "@/lib/supabase/queries";
import { ArticleCard } from "@/components/article-card";
import { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}/search`,
    },
  };
}

export const revalidate = 60;

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = await getTranslations({ locale, namespace: "search" });

  const query = q?.trim() ?? "";
  const articles = query ? await searchArticles(locale, query, { limit: 24 }) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-zinc-900">{t("search")}</h1>

      <form action={`/${locale}/search`} method="GET" className="mb-8">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("placeholder")}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {t("searchButton")}
          </button>
        </div>
      </form>

      {query && (
        <p className="mb-4 text-zinc-600">
          {t("resultsFor")}: <strong>{query}</strong>
        </p>
      )}

      {articles.length === 0 ? (
        <p className="text-zinc-500">
          {query ? t("noResults") : t("placeholder")}
        </p>
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
