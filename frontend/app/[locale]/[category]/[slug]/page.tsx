import { getTranslations } from "next-intl/server";
import { getArticleBySlug, getLatestArticles } from "@/lib/supabase/queries";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { formatDate } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { AdSenseBanner, AdSenseInArticle } from "@/components/adsense-banner";
import { AffiliateCallout } from "@/components/affiliate-link";
import {
  ArticleTracker,
  SourceLinkTracker,
} from "@/components/article-analytics";
import { ReportButton } from "@/components/report-button";
import { SITE_URL, articleImageUrl, categoryLabel } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string; category: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const article = await getArticleBySlug(locale, slug);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  const title = article.seo_meta_title || article.title;
  const description = article.seo_meta_description || "";
  const url = `/${locale}/${category}/${slug}`;
  const ogImage =
    article.featured_image_url ||
    `${SITE_URL}/api/og?title=${encodeURIComponent(
      title,
    )}&category=${encodeURIComponent(
      article.category_name?.[locale] ||
        article.category_name?.["en"] ||
        "Article",
    )}`;

  const languages: Record<string, string> = {};
  article.available_languages.forEach((lang) => {
    if (lang !== locale) {
      languages[lang] = `/${lang}/${category}/${slug}`;
    }
  });

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export const revalidate = 3600;

export default async function ArticlePage({ params }: Props) {
  const { locale, category, slug } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  const article = await getArticleBySlug(locale, slug);

  if (!article) {
    notFound();
  }

  const related = await getLatestArticles(locale, {
    categorySlug: article.category_slug ?? undefined,
    limit: 3,
  });

  const body =
    article.summary?.body || article.summary?.executive_summary || "";
  const takeaways = article.summary?.key_takeaways || [];
  const story = article.summary?.story || "";
  const spokenLanguage = article.summary?.spoken_language || "";

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <ArticleTracker articleId={article.article_id} />
      {article.youtube_video_id ? (
        <div className="mb-8 aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${article.youtube_video_id}`}
            title={article.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        article.featured_image_url && (
          <img
            src={articleImageUrl(article.featured_image_url) ?? undefined}
            alt={article.title}
            className="mb-8 aspect-video w-full rounded-xl object-cover"
          />
        )
      )}

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
          {article.category_name && (
            <Link
              href={`/${article.category_slug}` as any}
              className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-200"
            >
              {categoryLabel(article.category_name, article.category_slug, locale)}
            </Link>
          )}
          <time dateTime={article.published_at ?? undefined}>
            {formatDate(article.published_at, locale)}
          </time>
          {article.author && <span>by {article.author}</span>}
          {spokenLanguage && (
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              {t("spokenLanguage")}: {spokenLanguage}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-tight text-zinc-900 sm:text-4xl">
          {article.title}
        </h1>
      </header>

      {takeaways.length > 0 && (
        <section className="mb-10 rounded-xl bg-blue-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-blue-900">
            {t("keyTakeaways")}
          </h2>
          <ul className="list-inside list-disc space-y-2 text-blue-900">
            {takeaways.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </section>
      )}

      <AdSenseBanner
        slot="article-top-banner"
        layout="display"
        className="my-8 min-h-[90px] w-full"
      />

      <div className="prose prose-zinc max-w-none">
        {body.split("\n\n").map((paragraph, i) => (
          <p key={i} className="mb-4 leading-relaxed text-zinc-700">
            {paragraph}
          </p>
        ))}
      </div>

      {story && (
        <section className="mb-10 rounded-xl bg-purple-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-purple-900">
            {t("story")}
          </h2>
          <div className="space-y-4 text-purple-950">
            {String(story)
              .split("\n\n")
              .map((p, i) => (
                <p key={i} className="leading-relaxed">
                  {p}
                </p>
              ))}
          </div>
        </section>
      )}

      <AdSenseInArticle slot="article-in-content" className="my-8" />

      <AffiliateCallout
        title="Recommended for you"
        description="Tools and services we trust to boost productivity and content workflows."
        cta="Browse picks"
      />

      {article.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-zinc-200 pt-6">
        <SourceLinkTracker
          articleId={article.article_id}
          href={article.source_url}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {t("source")} →
        </SourceLinkTracker>
        <div className="mt-4">
          <ReportButton articleId={article.article_id} locale={locale} />
        </div>
      </div>

      <AdSenseBanner
        slot="article-bottom-banner"
        layout="display"
        className="my-8 min-h-[250px] w-full"
      />

      {related.length > 0 && (
        <aside className="mt-12">
          <h2 className="mb-6 text-xl font-bold text-zinc-900">
            {t("related")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related
              .filter((a) => a.article_id !== article.article_id)
              .map((a) => (
                <ArticleCard key={a.article_id} article={a} locale={locale} />
              ))}
          </div>
        </aside>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.seo_meta_description,
            url: `/${locale}/${category}/${slug}`,
            image: article.featured_image_url,
            author: article.author
              ? { "@type": "Person", name: article.author }
              : undefined,
            publisher: {
              "@type": "Organization",
              name: "AI SharePlus",
            },
            datePublished: article.published_at,
            inLanguage: locale,
          }),
        }}
      />
    </article>
  );
}
