import { getTranslations } from "next-intl/server";
import { getLatestArticles, getPopularTags } from "@/lib/supabase/queries";
import { ArticleCard } from "@/components/article-card";
import { FeaturedArticle } from "@/components/featured-article";
import { Link } from "@/i18n/routing";
import { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
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

export const revalidate = 1800;

const PAGE_SIZE = 12;

const pageLabels: Record<string, { prev: string; next: string; page: string; topics: string }> = {
  en: { prev: "Newer", next: "Older", page: "Page", topics: "Popular topics" },
  he: { prev: "חדשות יותר", next: "ישנות יותר", page: "עמוד", topics: "נושאים פופולריים" },
  es: { prev: "Más recientes", next: "Más antiguos", page: "Página", topics: "Temas populares" },
  ar: { prev: "الأحدث", next: "الأقدم", page: "صفحة", topics: "مواضيع شائعة" },
};

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const t = await getTranslations({ locale, namespace: "home" });
  const labels = pageLabels[locale] ?? pageLabels.en;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const [articles, popularTags] = await Promise.all([
    getLatestArticles(locale, {
      limit: PAGE_SIZE + 1,
      offset,
    }),
    getPopularTags(locale, 12),
  ]);
  const hasNext = articles.length > PAGE_SIZE;
  const pageArticles = articles.slice(0, PAGE_SIZE);

  const featured = (() => {
    if (page !== 1 || pageArticles.length === 0) return null;
    const withImages = pageArticles.filter((a) => a.featured_image_url);
    const pool = withImages.length > 0 ? withImages : pageArticles;
    return pool[Math.floor(Math.random() * pool.length)];
  })();
  const gridArticles = featured
    ? pageArticles.filter((a) => a.article_id !== featured.article_id)
    : pageArticles;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900">
        {t("latest")}
      </h1>
      <p className="mb-8 text-zinc-600">
        AI summaries from around the web, translated for you.
      </p>

      {popularTags.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {labels.topics}
          </h2>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((p) => (
              <Link
                key={p.tag}
                href={`/tag/${encodeURIComponent(p.tag)}` as any}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {p.tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {pageArticles.length === 0 ? (
        <p className="text-zinc-500">{t("noResults")}</p>
      ) : (
        <>
          {featured && (
            <div className="mb-10">
              <FeaturedArticle article={featured} locale={locale} />
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridArticles.map((article) => (
              <ArticleCard
                key={article.article_id}
                article={article}
                locale={locale}
              />
            ))}
          </div>

          {(page > 1 || hasNext) && (
            <nav
              aria-label="Pagination"
              className="mt-10 flex items-center justify-between"
            >
              {page > 1 ? (
                <Link
                  href={page === 2 ? (`/` as any) : (`/?page=${page - 1}` as any)}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  ← {labels.prev}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-zinc-500">
                {labels.page} {page}
              </span>
              {hasNext ? (
                <Link
                  href={`/?page=${page + 1}` as any}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  {labels.next} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
