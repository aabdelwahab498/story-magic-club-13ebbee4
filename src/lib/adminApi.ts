import { supabase } from "@/integrations/supabase/client";
import type { Multilingual } from "@/lib/multilingual";
import { STORAGE_BUCKETS } from "@/lib/adminConstants";

export interface StoryRecord {
  id: string;
  title: Multilingual;
  description: Multilingual;
  content: Multilingual;
  age_range: string | null;
  category: string | null;
  image: string | null;
  audio_url: string | null;
  duration: string | null;
  published: boolean;
  views: number;
  video_embed_url: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoRecord {
  id: string;
  title: Multilingual;
  description: Multilingual;
  thumbnail: string | null;
  video_url: string | null;
  source_type: "url" | "upload";
  age_range: string | null;
  category: string | null;
  duration: string | null;
  published: boolean;
  views: number;
  created_at: string;
  updated_at: string;
}

const toMultilingual = (v: unknown): Multilingual => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Multilingual;
  return {};
};

// ============== STORIES ==============
export async function fetchStories(): Promise<StoryRecord[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    title: toMultilingual(s.title),
    description: toMultilingual(s.description),
    content: toMultilingual(s.content),
  })) as StoryRecord[];
}

export async function upsertStory(
  story: Partial<StoryRecord> & { id?: string }
): Promise<StoryRecord> {
  const isNew = !story.id || story.id.startsWith("new-");
  const payload = {
    title: story.title ?? {},
    description: story.description ?? {},
    content: story.content ?? {},
    age_range: story.age_range ?? null,
    category: story.category ?? null,
    image: story.image ?? null,
    audio_url: story.audio_url ?? null,
    duration: story.duration ?? null,
    published: story.published ?? false,
    video_embed_url: story.video_embed_url ?? null,
    pdf_url: story.pdf_url ?? null,
  };
  if (isNew) {
    const { data, error } = await supabase
      .from("stories")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      title: toMultilingual(data.title),
      description: toMultilingual(data.description),
      content: toMultilingual(data.content),
    } as StoryRecord;
  }
  const { data, error } = await supabase
    .from("stories")
    .update(payload)
    .eq("id", story.id!)
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    title: toMultilingual(data.title),
    description: toMultilingual(data.description),
    content: toMultilingual(data.content),
  } as StoryRecord;
}

export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
}

// ============== VIDEOS ==============
export async function fetchVideos(): Promise<VideoRecord[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((v) => ({
    ...v,
    title: toMultilingual(v.title),
    description: toMultilingual(v.description),
    source_type: (v.source_type as "url" | "upload") ?? "url",
  })) as VideoRecord[];
}

export async function upsertVideo(
  video: Partial<VideoRecord> & { id?: string }
): Promise<VideoRecord> {
  const isNew = !video.id || video.id.startsWith("new-");
  const payload = {
    title: video.title ?? {},
    description: video.description ?? {},
    thumbnail: video.thumbnail ?? null,
    video_url: video.video_url ?? null,
    source_type: video.source_type ?? "url",
    age_range: video.age_range ?? null,
    category: video.category ?? null,
    duration: video.duration ?? null,
    published: video.published ?? false,
  };
  if (isNew) {
    const { data, error } = await supabase
      .from("videos")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      title: toMultilingual(data.title),
      description: toMultilingual(data.description),
      source_type: (data.source_type as "url" | "upload") ?? "url",
    } as VideoRecord;
  }
  const { data, error } = await supabase
    .from("videos")
    .update(payload)
    .eq("id", video.id!)
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    title: toMultilingual(data.title),
    description: toMultilingual(data.description),
    source_type: (data.source_type as "url" | "upload") ?? "url",
  } as VideoRecord;
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) throw error;
}

// ============== STORAGE UPLOADS ==============
async function uploadToBucket(bucket: string, file: File, prefix = ""): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

export const uploadStoryImage = (file: File) =>
  uploadToBucket(STORAGE_BUCKETS.storyImages, file, "story-img-");

export const uploadStoryAudio = (file: File) =>
  uploadToBucket(STORAGE_BUCKETS.storyAudio, file, "story-audio-");

export const uploadStoryPdf = (file: File) =>
  uploadToBucket(STORAGE_BUCKETS.storyPdfs, file, "story-pdf-");

export const uploadVideoThumbnail = (file: File) =>
  uploadToBucket(STORAGE_BUCKETS.videoThumbnails, file, "thumb-");

export const uploadProductImage = (file: File) =>
  uploadToBucket(STORAGE_BUCKETS.storyImages, file, "product-");

export const uploadProductAttachment = (file: File) =>
  uploadToBucket(STORAGE_BUCKETS.storyPdfs, file, "product-attach-");

export async function uploadVideoFile(file: File): Promise<string> {
  // video-uploads is private; we still expose via public URL because RLS read is staff-only.
  // For end-users to view, we issue a signed URL on demand.
  const ext = file.name.split(".").pop() ?? "mp4";
  const fileName = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.videoUploads)
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  // Return path — caller uses signed URL when serving.
  const { data, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKETS.videoUploads)
    .createSignedUrl(fileName, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  return data.signedUrl;
}

// ============== PRODUCTS ==============
export interface ProductGalleryItem {
  type: "pdf" | "image" | "video" | "link";
  url: string;
  label_en?: string;
  label_ar?: string;
}

export interface ProductRecord {
  id: string;
  sku: string | null;
  name: Multilingual;
  description: Multilingual;
  category: string | null;
  image: string | null;
  gallery: ProductGalleryItem[];
  price_egp: number | null;
  price_usd: number | null;
  price_eur: number | null;
  age_range: string | null;
  stock: number | null;
  active: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

const toGallery = (v: unknown): ProductGalleryItem[] => {
  if (Array.isArray(v)) return v as ProductGalleryItem[];
  return [];
};

export async function fetchProducts(): Promise<ProductRecord[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    ...p,
    name: toMultilingual(p.name),
    description: toMultilingual(p.description),
    gallery: toGallery(p.gallery),
  })) as ProductRecord[];
}

export async function upsertProduct(
  product: Partial<ProductRecord> & { id?: string }
): Promise<ProductRecord> {
  const isNew = !product.id || product.id.startsWith("new-");
  const payload = {
    sku: product.sku ?? null,
    name: product.name ?? {},
    description: product.description ?? {},
    category: product.category ?? null,
    image: product.image ?? null,
    gallery: (product.gallery ?? []) as unknown as never,
    price_egp: product.price_egp ?? null,
    price_usd: product.price_usd ?? null,
    price_eur: product.price_eur ?? null,
    age_range: product.age_range ?? null,
    stock: product.stock ?? 0,
    active: product.active ?? true,
    featured: product.featured ?? false,
  };
  if (isNew) {
    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      name: toMultilingual(data.name),
      description: toMultilingual(data.description),
      gallery: toGallery(data.gallery),
    } as ProductRecord;
  }
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", product.id!)
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    name: toMultilingual(data.name),
    description: toMultilingual(data.description),
    gallery: toGallery(data.gallery),
  } as ProductRecord;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

