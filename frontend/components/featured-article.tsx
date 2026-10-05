import { Link } from "@/i18n/routing";
import { ArticleSummary } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils";

const badgeLabels: Record<string, string> = {
  en: "Featured",
  he: "כתבה נבחרת",
  es: "Destacado",
  ar: "مقال مميز",
};

export function FeaturedArticle({
  article,
  locale,
}: {
  article: ArticleSummary;
  locale: string;
}) {
  const href = `/${article.category_slug ?? "uncategorized"}/${article.seo_slug}`;
  const summaryText =
    article.summary?.executive_summary || article.summary?.body || "";

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md">
      <Link
        href={href as any}
        className="group grid md:grid-cols-2 md:gap-6"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-100 md:aspect-auto md:min-h-64">
          {article.featured_image_url ? (
            <img
              src={article.featured_image_url}
              alt={article.title}
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-6xl font-bold text-white/30">
              AI
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-blue-600 px-2.5 py-1 font-semibold text-white">
              {badgeLabels[locale] ?? badgeLabels.en}
            </span>
            {article.category_name && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
                {article.category_name[locale] ?? article.category_name["en"]}
              </span>
            )}
            <time
              dateTime={article.published_at ?? undefined}
              className="text-zinc-500"
            >
              {formatDate(article.published_at, locale)}
            </time>
          </div>
          <h2 className="text-2xl font-bold leading-tight text-zinc-900 group-hover:underline md:text-3xl">
            {article.title}
          </h2>
          {summaryText && (
            <p className="line-clamp-4 text-sm leading-relaxed text-zinc-600 md:text-base">
              {summaryText}
            </p>
          )}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5">
              {article.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
