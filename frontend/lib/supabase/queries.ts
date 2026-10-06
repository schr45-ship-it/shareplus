import { supabaseBuild } from "./build";
import type { Database } from "./database.types";

export type ArticleSummary = {
  article_id: string;
  language: string;
  title: string;
  seo_slug: string;
  seo_meta_description: string | null;
  summary: {
    executive_summary?: string;
    body?: string;
  };
  tags: string[];
  published_at: string | null;
  category_slug: string | null;
  category_name: Record<string, string> | null;
  featured_image_url: string | null;
  subcategory_slug?: string | null;
  subcategory_name?: Record<string, string> | null;
};

export type ArticleDetail = {
  article_id: string;
  language: string;
  title: string;
  seo_slug: string;
  seo_meta_title: string | null;
  seo_meta_description: string | null;
  summary: {
    executive_summary?: string;
    key_takeaways?: string[];
    body?: string;
    story?: string | null;
    spoken_language?: string | null;
    video_url?: string | null;
  };
  tags: string[];
  source_url: string;
  source_type: string;
  original_language: string;
  published_at: string | null;
  featured_image_url: string | null;
  category_slug: string | null;
  category_name: Record<string, string> | null;
  author: string | null;
  video_duration_seconds: number | null;
  available_languages: string[];
  youtube_video_id: string | null;
};

export async function getLatestArticles(
  language: string,
  options: {
    categorySlug?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ArticleSummary[]> {
  const supabase = supabaseBuild;
  const { data, error } = await (supabase.rpc as any)("get_latest_articles", {
    p_language: language,
    p_category_slug: options.categorySlug ?? null,
    p_limit: options.limit ?? 20,
    p_offset: options.offset ?? 0,
  });

  if (error) {
    console.error("getLatestArticles error:", error);
    return [];
  }

  return (data ?? []) as unknown as ArticleSummary[];
}

export async function getArticleBySlug(
  language: string,
  slug: string,
): Promise<ArticleDetail | null> {
  const supabase = supabaseBuild;
  const { data, error } = await (supabase.rpc as any)("get_article_by_slug", {
    p_language: language,
    p_slug: slug,
  });

  if (error || !data || data.length === 0) {
    console.error("getArticleBySlug error:", error);
    return null;
  }

  return data[0] as unknown as ArticleDetail;
}

export async function searchArticles(
  language: string,
  query: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ArticleSummary[]> {
  const supabase = supabaseBuild;
  const { data, error } = await (supabase.rpc as any)("search_articles", {
    p_language: language,
    p_query: query,
    p_limit: options.limit ?? 20,
    p_offset: options.offset ?? 0,
  });

  if (error) {
    console.error("searchArticles error:", error);
    return [];
  }

  return ((data ?? []) as unknown[]).map((item) => {
    const row = item as ArticleSummary & { rank?: number };
    const { rank: _rank, ...article } = row;
    return article;
  });
}

export async function getArticlesByTag(
  language: string,
  tag: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ArticleSummary[]> {
  const supabase = supabaseBuild;
  const { data, error } = await (supabase.rpc as any)("get_articles_by_tag", {
    p_language: language,
    p_tag: tag,
    p_limit: options.limit ?? 20,
    p_offset: options.offset ?? 0,
  });

  if (error) {
    console.error("getArticlesByTag error:", error);
    return [];
  }

  return (data ?? []) as unknown as ArticleSummary[];
}

export async function getPopularTags(
  language: string,
  limit = 20,
): Promise<{ tag: string; count: number }[]> {
  const supabase = supabaseBuild;
  const { data, error } = await (supabase.rpc as any)("get_popular_tags", {
    p_language: language,
    p_limit: limit,
  });

  if (error) {
    console.error("getPopularTags error:", error);
    return [];
  }

  return (data ?? []) as unknown as { tag: string; count: number }[];
}

export async function getCategoryCounts(language: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await (supabaseBuild.from("articles") as any)
      .select("category_id,categories!inner(slug),article_translations!inner(language)")
      .eq("status", "published")
      .eq("article_translations.language", language)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("getCategoryCounts error:", error);
      return counts;
    }

    const rows = (data ?? []) as Array<{ categories?: { slug?: string } | null }>;
    for (const row of rows) {
      const slug = row.categories?.slug;
      if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return counts;
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function getCategories(language: string): Promise<Category[]> {
  const supabase = supabaseBuild;
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("slug");

  if (error) {
    console.error("getCategories error:", error);
    return [];
  }

  return data ?? [];
}
