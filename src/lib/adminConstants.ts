import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/i18n/config";

export const ADMIN_LANGUAGES = SUPPORTED_LANGUAGES;
export type AdminLanguageCode = LanguageCode;

export const STORY_CATEGORIES = [
  "bedtime",
  "adventure",
  "thriller",
  "fairytale",
  "educational",
  "fantasy",
  "animals",
  "space",
] as const;

export const VIDEO_CATEGORIES = [
  "lullaby",
  "cartoon",
  "thriller",
  "educational",
  "songs",
  "stories",
] as const;

export const AGE_RANGES = ["3-5", "6-8", "9-12"] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];
export type AgeRange = (typeof AGE_RANGES)[number];

export const STORAGE_BUCKETS = {
  storyImages: "story-images",
  storyAudio: "story-audio",
  storyPdfs: "story-pdfs",
  videoThumbnails: "video-thumbnails",
  videoUploads: "video-uploads",
} as const;

export const PRODUCT_CATEGORIES = [
  "course",
  "book",
  "bundle",
  "merchandise",
  "digital",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
