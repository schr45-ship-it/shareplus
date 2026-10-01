import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { locales, defaultLocale } from "@/i18n/routing";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: articles } = await supabase
    .from("article_translations")
    .select(
      `
      language,
      seo_slug,
      updated_at,
      articles!inner(category_id, status, published_at, categories(slug))
    `,
    )
    .eq("articles.status", "published")
    .order("updated_at", { ascending: false });

  const entries: MetadataRoute.Sitemap = [];

  // Homepage for each locale
  for (const locale of locales) {
    entries.push({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    });
  }

  // Articles
  for (const article of articles ?? []) {
    const row = article as unknown as {
      language: string;
      seo_slug: string;
      updated_at: string;
      articles: {
        status: string;
        published_at: string;
        categories: { slug: string } | null;
      };
    };

    const categorySlug = row.articles.categories?.slug ?? "uncategorized";
    entries.push({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/${row.language}/${categorySlug}/${row.seo_slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
