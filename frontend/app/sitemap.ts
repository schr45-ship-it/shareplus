import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const STATIC_PAGES = [
  "",
  "/about",
  "/contact",
  "/gallery",
  "/search",
  "/privacy",
  "/terms",
  "/accessibility",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: articles }, { data: categories }, { data: blockedTagsData }] = await Promise.all([
    supabase
      .from("article_translations")
      .select(
        `
        language,
        seo_slug,
        updated_at,
        tags,
        articles!inner(category_id, status, published_at, categories(slug))
      `,
      )
      .eq("articles.status", "published")
      .order("updated_at", { ascending: false }),
    supabase.from("categories").select("slug").eq("is_active", true),
    supabase.from("blocked_tags").select("tag"),
  ]);

  const blockedTags = new Set((blockedTagsData ?? []).map((b: { tag: string }) => b.tag.toLowerCase()));
  const hasBlockedTag = (tags: string[] | null) =>
    (tags ?? []).some((tag) => blockedTags.has(tag.toLowerCase()));

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of STATIC_PAGES) {
      entries.push({
        url: `${SITE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === "" ? "daily" : "monthly",
        priority: page === "" ? 1 : 0.5,
      });
    }

    for (const cat of (categories ?? []) as { slug: string }[]) {
      entries.push({
        url: `${SITE_URL}/${locale}/${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  for (const article of articles ?? []) {
    const row = article as unknown as {
      language: string;
      seo_slug: string;
      updated_at: string;
      tags: string[];
      articles: {
        status: string;
        published_at: string;
        categories: { slug: string } | null;
      };
    };

    if (hasBlockedTag(row.tags)) continue;

    const categorySlug = row.articles.categories?.slug ?? "other";
    entries.push({
      url: `${SITE_URL}/${row.language}/${categorySlug}/${row.seo_slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
