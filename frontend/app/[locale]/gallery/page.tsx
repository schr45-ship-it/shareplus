import { getCategories, getLatestArticles } from "@/lib/supabase/queries";
import { Link } from "@/i18n/routing";
import { Metadata } from "next";
import { articleImageUrl } from "@/lib/site";

type Props = { params: Promise<{ locale: string }> };

const titles: Record<string, string> = {
  en: "Image Gallery",
  he: "גלריית תמונות",
  es: "Galería de imágenes",
  ar: "معرض الصور",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: titles[locale] ?? titles.en,
    alternates: { canonical: `/${locale}/gallery` },
  };
}

export const revalidate = 1800;

export default async function GalleryPage({ params }: Props) {
  const { locale } = await params;
  const categories = await getCategories(locale);

  const groups = await Promise.all(
    categories.map(async (category) => {
      const articles = await getLatestArticles(locale, {
        categorySlug: category.slug,
        limit: 12,
      });
      return {
        category,
        articles: articles.filter((a) => a.featured_image_url),
      };
    }),
  );

  const nonEmpty = groups.filter((g) => g.articles.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-zinc-900">
        {titles[locale] ?? titles.en}
      </h1>

      {nonEmpty.map(({ category, articles }) => (
        <section key={category.id} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-zinc-800">
            {category.name_json[locale] ?? category.name_json["en"] ?? category.slug}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {articles.map((a) => (
              <Link
                key={a.article_id}
                href={`/${category.slug}/${a.seo_slug}` as any}
                className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-video w-full overflow-hidden bg-zinc-100">
                  <img
                    src={articleImageUrl(a.featured_image_url) ?? undefined}
                    alt={a.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="line-clamp-2 p-3 text-sm font-medium text-zinc-800 group-hover:underline">
                  {a.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
