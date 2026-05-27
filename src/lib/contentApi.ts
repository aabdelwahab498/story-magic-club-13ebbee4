// Phase 1 — DB-backed content API (replaces mockBlog/mockStore).
// Multilingual JSONB shape: { en, ar, fr, de, it, es }.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Multilingual } from "./multilingual";

export interface BlogCategoryRow {
  id: string;
  slug: string;
  name: Multilingual;
}

export interface BlogPostRow {
  id: string;
  slug: string;
  category_id: string | null;
  title: Multilingual;
  excerpt: Multilingual;
  content: Multilingual;
  cover_image: string | null;
  author_name: string | null;
  reading_minutes: number | null;
  tags: string[] | null;
  published: boolean;
  published_at: string | null;
  views: number;
  created_at: string;
  category_slug?: string | null;
}

export interface ProductRow {
  id: string;
  sku: string | null;
  name: Multilingual;
  description: Multilingual;
  category: string | null;
  image: string | null;
  gallery: unknown;
  price_egp: number | null;
  price_usd: number | null;
  price_eur: number | null;
  age_range: string | null;
  stock: number | null;
  active: boolean;
  featured: boolean;
}

// ---------- Blog ----------
export const useBlogPosts = () =>
  useQuery({
    queryKey: ["blog_posts"],
    queryFn: async (): Promise<BlogPostRow[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, blog_categories(slug)")
        .eq("published", true)
        .order("published_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        category_slug: p.blog_categories?.slug ?? null,
      }));
    },
  });

export const useBlogPost = (slug: string | undefined) =>
  useQuery({
    queryKey: ["blog_post", slug],
    enabled: !!slug,
    queryFn: async (): Promise<BlogPostRow | null> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, blog_categories(slug)")
        .eq("slug", slug!)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...(data as any), category_slug: (data as any).blog_categories?.slug ?? null };
    },
  });

// ---------- Store ----------
export const useProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

// ---------- Drawing Competition ----------
export interface DrawingEntryRow {
  id: string;
  title: Multilingual;
  artist: Multilingual & { country?: Multilingual; countryFlag?: string };
  image: string | null;
  votes: number;
  approved: boolean;
  created_at: string;
}

export const useTopDrawings = (limit = 6) =>
  useQuery({
    queryKey: ["drawings_top", limit],
    queryFn: async (): Promise<DrawingEntryRow[]> => {
      const { data, error } = await supabase
        .from("drawing_entries")
        .select("*")
        .eq("approved", true)
        .order("votes", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as DrawingEntryRow[];
    },
  });

export const useWinnerOfTheWeek = () =>
  useQuery({
    queryKey: ["drawings_winner_week"],
    queryFn: async (): Promise<DrawingEntryRow | null> => {
      const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("drawing_entries")
        .select("*")
        .eq("approved", true)
        .gte("created_at", sinceIso)
        .order("votes", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as DrawingEntryRow) ?? null;
    },
  });

// ---------- Site stats ----------
export interface SiteStats {
  total_stories: number;
  total_users: number;
  total_drawings: number;
}

export const useSiteStats = () =>
  useQuery({
    queryKey: ["site_stats"],
    queryFn: async (): Promise<SiteStats> => {
      const { data, error } = await supabase
        .from("site_stats" as never)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (
        (data as unknown as SiteStats) ?? { total_stories: 0, total_users: 0, total_drawings: 0 }
      );
    },
    staleTime: 60_000,
  });
