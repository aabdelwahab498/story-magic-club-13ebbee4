import type { Multilingual } from "./multilingual";

export interface MockStory {
  id: string;
  title: Multilingual;
  description: Multilingual;
  content: Multilingual;
  age_range: string;
  category: string;
  image: string | null;
  audio_url: string | null;
  duration: string | null;
  published: boolean;
  views: number;
  video_embed_url?: string | null;
  pdf_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockVideo {
  id: string;
  title: Multilingual;
  description: Multilingual;
  thumbnail: string | null;
  video_url: string;
  source_type: "url" | "upload";
  age_range: string;
  category: string;
  duration: string | null;
  published: boolean;
  views: number;
  created_at: string;
  updated_at: string;
}

const today = new Date().toISOString();

export const MOCK_STORIES: MockStory[] = [
  {
    id: "mock-story-1",
    title: {
      en: "The Brave Little Star",
      ar: "النجمة الشجاعة الصغيرة",
      de: "Der mutige kleine Stern",
      fr: "La petite étoile courageuse",
      it: "La piccola stella coraggiosa",
      es: "La pequeña estrella valiente",
    },
    description: {
      en: "A tiny star learns courage on a magical night.",
      ar: "نجمة صغيرة تتعلم الشجاعة في ليلة سحرية.",
      de: "Ein winziger Stern lernt in einer magischen Nacht Mut.",
      fr: "Une petite étoile apprend le courage par une nuit magique.",
      it: "Una piccola stella impara il coraggio in una notte magica.",
      es: "Una pequeña estrella aprende valentía en una noche mágica.",
    },
    content: {
      en: "Once upon a time, high above the clouds, lived the smallest star in the sky...",
    },
    age_range: "3-5",
    category: "bedtime",
    image: null,
    audio_url: null,
    duration: "3 min",
    published: true,
    views: 1240,
    created_at: today,
    updated_at: today,
  },
  {
    id: "mock-story-2",
    title: {
      en: "Luna and the Moon Garden",
      ar: "لونا وحديقة القمر",
      de: "Luna und der Mondgarten",
      fr: "Luna et le jardin de la lune",
      it: "Luna e il giardino della luna",
      es: "Luna y el jardín de la luna",
    },
    description: {
      en: "Luna discovers a secret garden that only blooms at night.",
    },
    content: { en: "Luna pressed her nose against the window..." },
    age_range: "6-8",
    category: "fantasy",
    image: null,
    audio_url: null,
    duration: "5 min",
    published: true,
    views: 980,
    created_at: today,
    updated_at: today,
  },
  {
    id: "mock-story-3",
    title: {
      en: "The Sleepy Dragon",
      ar: "التنين النائم",
      de: "Der schläfrige Drache",
      fr: "Le dragon endormi",
      it: "Il drago assonnato",
      es: "El dragón dormilón",
    },
    description: { en: "A friendly dragon who just wants a good nap." },
    content: { en: "" },
    age_range: "3-5",
    category: "bedtime",
    image: null,
    audio_url: null,
    duration: "4 min",
    published: false,
    views: 0,
    created_at: today,
    updated_at: today,
  },
];

export const MOCK_VIDEOS: MockVideo[] = [
  {
    id: "mock-video-1",
    title: {
      en: "Twinkle Twinkle Lullaby",
      ar: "أغنية النجمة الوامضة",
      de: "Funkel funkel kleiner Stern",
      fr: "Brille petite étoile",
      it: "Brilla brilla stellina",
      es: "Brilla brilla estrellita",
    },
    description: { en: "A calming animated lullaby for bedtime." },
    thumbnail: null,
    video_url: "https://example.com/lullaby.mp4",
    source_type: "url",
    age_range: "3-5",
    category: "lullaby",
    duration: "3:21",
    published: true,
    views: 2150,
    created_at: today,
    updated_at: today,
  },
  {
    id: "mock-video-2",
    title: {
      en: "Counting with Stars",
      ar: "العد مع النجوم",
      de: "Zählen mit Sternen",
      fr: "Compter avec les étoiles",
      it: "Contare con le stelle",
      es: "Contar con las estrellas",
    },
    description: { en: "Learn to count from 1 to 10 with friendly stars." },
    thumbnail: null,
    video_url: "https://example.com/counting.mp4",
    source_type: "url",
    age_range: "3-5",
    category: "educational",
    duration: "5:00",
    published: true,
    views: 1420,
    created_at: today,
    updated_at: today,
  },
];

export const MOCK_STATS = {
  totalStories: MOCK_STORIES.length,
  publishedStories: MOCK_STORIES.filter((s) => s.published).length,
  totalVideos: MOCK_VIDEOS.length,
  publishedVideos: MOCK_VIDEOS.filter((v) => v.published).length,
  activeLanguages: 6,
  totalViews:
    MOCK_STORIES.reduce((s, x) => s + x.views, 0) +
    MOCK_VIDEOS.reduce((s, x) => s + x.views, 0),
};
