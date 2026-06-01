import { supabase } from "@/integrations/supabase/client";
import type { Multilingual } from "@/lib/multilingual";
import { STORAGE_BUCKETS } from "@/lib/adminConstants";

export interface BlogPostRecord {
  id: string;
  slug: string;
  category_id: string | null;
  title: Multilingual;
  excerpt: Multilingual;
  content: Multilingual;
  seo_title: Multilingual;
  seo_description: Multilingual;
  cover_image: string | null;
  author_name: string | null;
  reading_minutes: number | null;
  tags: string[] | null;
  published: boolean;
  published_at: string | null;
  views: number;
  created_at: string;
  updated_at: string;
  submission_status?: "pending" | "approved" | "rejected";
  review_note?: string | null;
  created_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface BlogCategoryRecord {
  id: string;
  slug: string;
  name: Multilingual;
}

const toM = (v: unknown): Multilingual =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Multilingual) : {};

const normalizePost = (p: any): BlogPostRecord => ({
  ...p,
  title: toM(p.title),
  excerpt: toM(p.excerpt),
  content: toM(p.content),
  seo_title: toM(p.seo_title),
  seo_description: toM(p.seo_description),
  tags: Array.isArray(p.tags) ? p.tags : [],
});

export async function fetchBlogPostsAdmin(): Promise<BlogPostRecord[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizePost);
}

export async function fetchBlogCategories(): Promise<BlogCategoryRecord[]> {
  const { data, error } = await supabase
    .from("blog_categories")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ ...c, name: toM(c.name) }));
}

export async function upsertBlogPost(
  post: Partial<BlogPostRecord> & { id?: string }
): Promise<BlogPostRecord> {
  const isNew = !post.id || post.id.startsWith("new-");
  const payload: any = {
    slug: post.slug ?? "",
    category_id: post.category_id ?? null,
    title: post.title ?? {},
    excerpt: post.excerpt ?? {},
    content: post.content ?? {},
    seo_title: post.seo_title ?? {},
    seo_description: post.seo_description ?? {},
    cover_image: post.cover_image ?? null,
    author_name: post.author_name ?? null,
    reading_minutes: post.reading_minutes ?? 3,
    tags: post.tags ?? [],
    published: post.published ?? false,
    published_at:
      post.published && !post.published_at
        ? new Date().toISOString()
        : post.published_at ?? null,
  };
  if (isNew) {
    const { data, error } = await supabase
      .from("blog_posts")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return normalizePost(data);
  }
  const { data, error } = await supabase
    .from("blog_posts")
    .update(payload)
    .eq("id", post.id!)
    .select()
    .single();
  if (error) throw error;
  return normalizePost(data);
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}

// --- Author submissions ---
export interface SubmitBlogPostInput {
  slug: string;
  category_id?: string | null;
  title: Multilingual;
  excerpt: Multilingual;
  content: Multilingual;
  cover_image?: string | null;
  author_name?: string | null;
  reading_minutes?: number | null;
  tags?: string[];
}

export async function submitBlogPost(
  input: SubmitBlogPostInput
): Promise<BlogPostRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const payload = {
    slug: input.slug,
    category_id: input.category_id ?? null,
    title: input.title,
    excerpt: input.excerpt,
    content: input.content,
    cover_image: input.cover_image ?? null,
    author_name: input.author_name ?? null,
    reading_minutes: input.reading_minutes ?? 3,
    tags: input.tags ?? [],
    published: false,
    submission_status: "pending",
    created_by: user.id,
  } as any;
  const { data, error } = await supabase
    .from("blog_posts")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return normalizePost(data);
}

export async function fetchMyBlogSubmissions(): Promise<BlogPostRecord[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizePost);
}

export async function approveBlogPost(id: string): Promise<BlogPostRecord> {
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      submission_status: "approved",
      published: true,
      published_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
    } as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizePost(data);
}

export async function rejectBlogPost(
  id: string,
  note?: string
): Promise<BlogPostRecord> {
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      submission_status: "rejected",
      published: false,
      review_note: note ?? null,
      reviewed_at: new Date().toISOString(),
    } as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizePost(data);
}

export async function uploadBlogCover(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `blog-cover-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.storyImages)
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.storyImages)
    .getPublicUrl(fileName);
  return data.publicUrl;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
