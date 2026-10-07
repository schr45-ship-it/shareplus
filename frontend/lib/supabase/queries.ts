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

export type GalleryArticle = {
  article_id: string;
  title: string;
  seo_slug: string;
  published_at: string | null;
  featured_image_url: string;
  category_slug: string;
  category_name: Record<string, string>;
  total_count: number;
};

export async function getGalleryArticles(
  language: string,
  options: { limit?: number; offset?: number } = {},
): Promise<GalleryArticle[]> {
  const { data, error } = await (supabaseBuild.rpc as any)("get_gallery_articles", {
    p_language: language,
    p_limit: options.limit ?? 24,
    p_offset: options.offset ?? 0,
  });
  if (error) {
    console.error("getGalleryArticles error:", error);
    return [];
  }
  return (data ?? []) as GalleryArticle[];
}

export async function getCategoryCounts(language: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const { data, error } = await (supabaseBuild.rpc as any)("get_category_counts", {
    p_language: language,
  });

  if (error) {
    console.error("getCategoryCounts error:", error);
    return counts;
  }

  for (const row of (data ?? []) as Array<{ category_slug: string | null; published_count: number }>) {
    if (row.category_slug) {
      counts[row.category_slug] = Number(row.published_count);
    }
  }

  return counts;
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function getBlockedTags(): Promise<string[]> {
  const { data, error } = await (supabaseBuild.from("blocked_tags").select("tag").order("tag") as any);
  if (error) {
    console.error("getBlockedTags error:", error);
    return [];
  }
  return ((data ?? []) as { tag: string }[]).map((row) => row.tag);
}

export async function adminBlockedTags(token: string): Promise<{ tag: string; reason: string | null; created_at: string }[]> {
  const { data, error } = await (supabaseBuild.rpc as any)("admin_blocked_tags", { p_token: token });
  if (error) {
    console.error("adminBlockedTags error:", error);
    return [];
  }
  return (data ?? []) as { tag: string; reason: string | null; created_at: string }[];
}

export async function adminBlockTag(token: string, tag: string, reason?: string): Promise<boolean> {
  const { error } = await (supabaseBuild.rpc as any)("admin_block_tag", {
    p_token: token,
    p_tag: tag.trim(),
    p_reason: reason?.trim() || null,
  });
  if (error) {
    console.error("adminBlockTag error:", error);
    return false;
  }
  return true;
}

export async function adminUnblockTag(token: string, tag: string): Promise<boolean> {
  const { error } = await (supabaseBuild.rpc as any)("admin_unblock_tag", { p_token: token, p_tag: tag });
  if (error) {
    console.error("adminUnblockTag error:", error);
    return false;
  }
  return true;
}

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
