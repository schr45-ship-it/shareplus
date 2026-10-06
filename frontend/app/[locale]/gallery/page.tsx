import { getGalleryArticles } from "@/lib/supabase/queries";
import { Link } from "@/i18n/routing";
import { Metadata } from "next";
import { articleThumbnailUrl, categoryLabel } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

const labels: Record<
  string,
  { title: string; empty: string; newer: string; older: string; page: string }
> = {
  en: {
    title: "Image Gallery",
    empty: "No images are available yet.",
    newer: "Newer",
    older: "Older",
    page: "Page",
  },
  he: {
    title: "גלריית תמונות",
    empty: "עדיין אין תמונות להצגה.",
    newer: "חדשות יותר",
    older: "ישנות יותר",
    page: "עמוד",
  },
  es: {
    title: "Galería de imágenes",
    empty: "Aún no hay imágenes disponibles.",
    newer: "Más recientes",
    older: "Más antiguas",
    page: "Página",
  },
  ar: {
    title: "معرض الصور",
    empty: "لا توجد صور متاحة بعد.",
    newer: "الأحدث",
    older: "الأقدم",
    page: "صفحة",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const text = labels[locale] ?? labels.en;
  return {
    title: text.title,
    alternates: { canonical: `/${locale}/gallery` },
  };
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const text = labels[locale] ?? labels.en;
  const requestedPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const articles = await getGalleryArticles(locale, {
    limit: PAGE_SIZE,
    offset: (requestedPage - 1) * PAGE_SIZE,
  });
  const totalCount = Number(articles[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-bold text-zinc-900">{text.title}</h1>
        {totalCount > 0 && <span className="text-sm text-zinc-500">{totalCount}</span>}
      </div>

      {articles.length === 0 ? (
        <p className="text-zinc-500">{text.empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {articles.map((article) => (
            <Link
              key={article.article_id}
              href={`/${article.category_slug}/${article.seo_slug}` as any}
              className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-video w-full overflow-hidden bg-zinc-100">
                <img
                  src={articleThumbnailUrl(article.featured_image_url) ?? undefined}
                  alt={article.title}
                  width={480}
                  height={270}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <span className="mb-1 block text-xs font-medium text-blue-600">
                  {categoryLabel(article.category_name, article.category_slug, locale)}
                </span>
                <p className="line-clamp-2 text-sm font-medium text-zinc-800 group-hover:underline">
                  {article.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
          {currentPage > 1 ? (
            <Link
              href={currentPage === 2 ? ("/gallery" as any) : (`/gallery?page=${currentPage - 1}` as any)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              ← {text.newer}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-zinc-500">
            {text.page} {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={`/gallery?page=${currentPage + 1}` as any}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {text.older} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
