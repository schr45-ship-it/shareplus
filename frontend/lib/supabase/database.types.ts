export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      articles: {
        Row: {
          id: string;
          source_id: string | null;
          source_url: string;
          source_type: "news" | "video";
          original_language: string;
          category_id: string | null;
          canonical_url: string | null;
          content_hash: string | null;
          featured_image_url: string | null;
          video_duration_seconds: number | null;
          author: string | null;
          published_date: string | null;
          raw_metadata: Json;
          status: string;
          processing_started_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["articles"]["Row"],
          "id" | "created_at" | "updated_at" | "published_at"
        > & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"] & { published_at?: string }>;
      };
      article_translations: {
        Row: {
          id: string;
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
          word_count: number | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["article_translations"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["article_translations"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name_json: Record<string, string>;
          description_json: Record<string, string>;
          color: string | null;
          created_at: string;
        };
      };
      sources: {
        Row: {
          id: string;
          name: string;
          source_type: "rss" | "youtube";
          url: string;
          language: string;
          category_id: string | null;
          is_active: boolean;
          last_checked_at: string | null;
          last_error: string | null;
          metadata: Json;
          created_at: string;
        };
      };
    };
    Functions: {
      search_articles: {
        Args: {
          p_language: string;
          p_query: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          article_id: string;
          language: string;
          title: string;
          seo_slug: string;
          seo_meta_description: string | null;
          summary: Json;
          tags: string[];
          status: string;
          published_at: string | null;
          category_slug: string | null;
          category_name: Json | null;
          rank: number;
        }[];
      };
      get_latest_articles: {
        Args: {
          p_language: string;
          p_category_slug?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          article_id: string;
          language: string;
          title: string;
          seo_slug: string;
          seo_meta_description: string | null;
          summary: Json;
          tags: string[];
          published_at: string | null;
          category_slug: string | null;
          category_name: Json | null;
          featured_image_url: string | null;
        }[];
      };
      get_article_by_slug: {
        Args: {
          p_language: string;
          p_slug: string;
        };
        Returns: {
          article_id: string;
          language: string;
          title: string;
          seo_slug: string;
          seo_meta_title: string | null;
          seo_meta_description: string | null;
          summary: Json;
          tags: string[];
          source_url: string;
          source_type: string;
          original_language: string;
          published_at: string | null;
          featured_image_url: string | null;
          category_slug: string | null;
          category_name: Json | null;
          author: string | null;
          video_duration_seconds: number | null;
          available_languages: string[];
        }[];
      };
      increment_article_views: {
        Args: { p_article_id: string };
        Returns: void;
      };
      increment_article_clicks: {
        Args: { p_article_id: string };
        Returns: void;
      };
      get_popular_articles: {
        Args: {
          p_language: string;
          p_limit?: number;
          p_category_slug?: string;
        };
        Returns: {
          article_id: string;
          language: string;
          title: string;
          seo_slug: string;
          seo_meta_description: string | null;
          summary: Json;
          tags: string[];
          published_at: string | null;
          category_slug: string | null;
          category_name: Json | null;
          featured_image_url: string | null;
          views: number;
        }[];
      };
    };
  };
};
