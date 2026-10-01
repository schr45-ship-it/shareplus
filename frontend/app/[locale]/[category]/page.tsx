import { getTranslations } from "next-intl/server";
import { getLatestArticles, getCategories } from "@/lib/supabase/queries";
import { ArticleCard } from "@/components/article-card";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; category: string }>;
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

export const revalidate = 3600;

export default async function CategoryPage({ params }: Props) {
  const { locale, category } = await params;
  const categories = await getCategories(locale);
  const categoryData = categories.find((c) => c.slug === category);

  if (!categoryData) {
    notFound();
  }

  const articles = await getLatestArticles(locale, {
    categorySlug: category,
    limit: 24,
  });

  const categoryName =
    categoryData.name_json[locale] ?? categoryData.name_json["en"] ?? category;

  const t = await getTranslations({ locale, namespace: "category" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-zinc-900">
        {t("articlesIn", { category: categoryName })}
      </h1>

      {articles.length === 0 ? (
        <p className="text-zinc-500">No articles in this category yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.article_id}
              article={article}
              locale={locale}
              categorySlug={category}
            />
          ))}
        </div>
      )}
    </div>
  );
}
