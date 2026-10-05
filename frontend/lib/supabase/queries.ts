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
