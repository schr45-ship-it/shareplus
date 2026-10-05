import { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getArticlesByTag, getPopularTags } from "@/lib/supabase/queries";
import { ArticleCard } from "@/components/article-card";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; tag: string }>;
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 20;

const dict: Record<
  string,
  { title: string; empty: string; popular: string; newer: string; older: string }
> = {
  he: { title: "תגית", empty: "אין עדיין כתבות עם התגית הזאת.", popular: "תגיות פופולריות", newer: "חדשות יותר", older: "ישנות יותר" },
  en: { title: "Tag", empty: "No articles with this tag yet.", popular: "Popular tags", newer: "Newer", older: "Older" },
  es: { title: "Etiqueta", empty: "Aún no hay artículos con esta etiqueta.", popular: "Etiquetas populares", newer: "Más recientes", older: "Más antiguos" },
  ar: { title: "وسم", empty: "لا توجد مقالات بهذا الوسم بعد.", popular: "وسوم شائعة", newer: "الأحدث", older: "الأقدم" },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tag } = await params;
  const t = dict[locale] ?? dict.en;
  const decoded = decodeURIComponent(tag);
  return {
    title: `${t.title}: ${decoded}`,
    alternates: { canonical: `/${locale}/tag/${encodeURIComponent(decoded)}` },
    robots: { index: true, follow: true },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { locale, tag } = await params;
  const { page } = await searchParams;
  const t = dict[locale] ?? dict.en;
  const decoded = decodeURIComponent(tag);
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const [articles, popular] = await Promise.all([
    getArticlesByTag(locale, decoded, { limit: PAGE_SIZE + 1, offset: (pageNum - 1) * PAGE_SIZE }),
    getPopularTags(locale, 15),
  ]);

  const hasMore = articles.length > PAGE_SIZE;
  const shown = articles.slice(0, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-zinc-900">
        <span className="text-zinc-400">{t.title}:</span> {decoded}
      </h1>

      {shown.length === 0 ? (
        <p className="text-zinc-600">{t.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <ArticleCard key={a.article_id} article={a} locale={locale} />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-4">
        {pageNum > 1 && (
          <Link
            href={`/tag/${encodeURIComponent(decoded)}?page=${pageNum - 1}` as any}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            ← {t.newer}
          </Link>
        )}
        {hasMore && (
          <Link
            href={`/tag/${encodeURIComponent(decoded)}?page=${pageNum + 1}` as any}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            {t.older} →
          </Link>
        )}
      </div>

      {popular.length > 1 && (
        <div className="mt-10 border-t border-zinc-200 pt-6">
          <h2 className="mb-3 text-sm font-semibold text-zinc-500">{t.popular}</h2>
          <div className="flex flex-wrap gap-2">
            {popular.map((p) => (
              <Link
                key={p.tag}
                href={`/tag/${encodeURIComponent(p.tag)}` as any}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  p.tag === decoded
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {p.tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
