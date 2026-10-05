import { Link } from "@/i18n/routing";
import { ArticleSummary } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils";

export function ArticleCard({
  article,
  locale,
  categorySlug,
}: {
  article: ArticleSummary;
  locale: string;
  categorySlug?: string | null;
}) {
  const href = categorySlug
    ? `/${categorySlug}/${article.seo_slug}`
    : `/${article.category_slug ?? "uncategorized"}/${article.seo_slug}`;

  const title = article.title || "Untitled";
  const summaryText =
    article.summary?.executive_summary || article.summary?.body || "";

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
      {article.featured_image_url && (
        <Link href={href as any} className="block aspect-video w-full overflow-hidden bg-zinc-100">
          <img
            src={article.featured_image_url}
            alt={title}
            className="h-full w-full object-cover transition duration-300 hover:scale-105"
            loading="lazy"
          />
        </Link>
      )}
      <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {article.category_name && (
          <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
            {article.category_name[locale] ?? article.category_name["en"]}
          </span>
        )}
        {article.subcategory_name && (
          <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">
            {article.subcategory_name[locale] ?? article.subcategory_name["en"]}
          </span>
        )}
        <time dateTime={article.published_at ?? undefined}>
          {formatDate(article.published_at, locale)}
        </time>
      </div>
      <h2 className="text-lg font-semibold leading-snug text-zinc-900">
        <Link href={href as any} className="hover:underline">
          {title}
        </Link>
      </h2>
      {summaryText && (
        <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600">
          {summaryText}
        </p>
      )}
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {article.tags.slice(0, 5).map((tag) => (
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
    </article>
  );
}
