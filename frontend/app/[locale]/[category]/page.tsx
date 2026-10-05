import { getTranslations } from "next-intl/server";
import { getLatestArticles, getCategories } from "@/lib/supabase/queries";
import { ArticleCard } from "@/components/article-card";
import { Link } from "@/i18n/routing";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  return {
    alternates: {
      canonical: `/${locale}/${category}`,
    },
  };
}

export async function generateStaticParams() {
  const categories = await getCategories("en");

  return categories.map((category) => ({
    category: category.slug,
  }));
}

export const dynamic = "force-dynamic";
export const revalidate = 1800;

const PAGE_SIZE = 12;

const pageLabels: Record<string, { prev: string; next: string; page: string }> = {
  en: { prev: "Newer", next: "Older", page: "Page" },
  he: { prev: "חדשות יותר", next: "ישנות יותר", page: "עמוד" },
  es: { prev: "Más recientes", next: "Más antiguos", page: "Página" },
  ar: { prev: "الأحدث", next: "الأقدم", page: "صفحة" },
};

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, category } = await params;
  const { page: pageParam } = await searchParams;
  const categories = await getCategories(locale);
  const categoryData = categories.find((c) => c.slug === category);

  if (!categoryData) {
    notFound();
  }

  const labels = pageLabels[locale] ?? pageLabels.en;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const articles = await getLatestArticles(locale, {
    categorySlug: category,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasNext = articles.length > PAGE_SIZE;
  const pageArticles = articles.slice(0, PAGE_SIZE);

  const categoryName =
    categoryData.name_json[locale] ?? categoryData.name_json["en"] ?? category;

  const t = await getTranslations({ locale, namespace: "category" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-zinc-900">
        {t("articlesIn", { category: categoryName })}
      </h1>

      {pageArticles.length === 0 ? (
        <p className="text-zinc-500">No articles in this category yet.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pageArticles.map((article) => (
              <ArticleCard
                key={article.article_id}
                article={article}
                locale={locale}
                categorySlug={category}
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
                  href={page === 2 ? (`/${category}` as any) : (`/${category}?page=${page - 1}` as any)}
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
                  href={`/${category}?page=${page + 1}` as any}
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
