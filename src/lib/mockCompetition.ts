import type { Multilingual } from "@/lib/multilingual";

export interface HallOfFameWinner {
  id: string;
  name: Multilingual;
  country: Multilingual;
  countryFlag: string; // emoji
  image: string;
  theme: Multilingual;
  period: Multilingual;
  votes: number;
}

/**
 * Compute the next Sunday 23:59 UTC as the weekly challenge deadline.
 * Stable per week so the countdown doesn't drift between renders.
 */
export function getWeeklyDeadline(): Date {
  const now = new Date();
  const d = new Date(now);
  // 0 = Sunday … 6 = Saturday
  const day = d.getUTCDay();
  const daysUntilSunday = (7 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  d.setUTCHours(23, 59, 0, 0);
  return d;
}

export const winnerOfTheWeek: HallOfFameWinner = {
  id: "wotw-1",
  name: { en: "Layla Hassan", ar: "ليلى حسن", fr: "Layla Hassan", es: "Layla Hassan", de: "Layla Hassan", it: "Layla Hassan" },
  country: { en: "Egypt", ar: "مصر", fr: "Égypte", es: "Egipto", de: "Ägypten", it: "Egitto" },
  countryFlag: "🇪🇬",
  image:
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&auto=format&fit=crop&q=70",
  theme: { en: "Magical Dreams", ar: "أحلام سحرية", fr: "Rêves magiques", es: "Sueños mágicos", de: "Magische Träume", it: "Sogni magici" },
  period: { en: "This Week", ar: "هذا الأسبوع", fr: "Cette semaine", es: "Esta semana", de: "Diese Woche", it: "Questa settimana" },
  votes: 248,
};

export const hallOfFame: HallOfFameWinner[] = [
  {
    id: "hof-1",
    name: { en: "Omar Khaled", ar: "عمر خالد" },
    country: { en: "UAE", ar: "الإمارات" },
    countryFlag: "🇦🇪",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=70",
    theme: { en: "Ocean Adventure", ar: "مغامرة المحيط" },
    period: { en: "Last week", ar: "الأسبوع الماضي" },
    votes: 192,
  },
  {
    id: "hof-2",
    name: { en: "Sophie Martin", ar: "صوفي مارتن" },
    country: { en: "France", ar: "فرنسا" },
    countryFlag: "🇫🇷",
    image: "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=600&auto=format&fit=crop&q=70",
    theme: { en: "Forest Friends", ar: "أصدقاء الغابة" },
    period: { en: "2 weeks ago", ar: "قبل أسبوعين" },
    votes: 176,
  },
  {
    id: "hof-3",
    name: { en: "Yusuf Ahmed", ar: "يوسف أحمد" },
    country: { en: "Saudi Arabia", ar: "السعودية" },
    countryFlag: "🇸🇦",
    image: "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=600&auto=format&fit=crop&q=70",
    theme: { en: "Space Heroes", ar: "أبطال الفضاء" },
    period: { en: "3 weeks ago", ar: "قبل ٣ أسابيع" },
    votes: 158,
  },
  {
    id: "hof-4",
    name: { en: "Mia Rossi", ar: "ميا روسي" },
    country: { en: "Italy", ar: "إيطاليا" },
    countryFlag: "🇮🇹",
    image: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&auto=format&fit=crop&q=70",
    theme: { en: "Rainbow Castle", ar: "قلعة قوس قزح" },
    period: { en: "Last month", ar: "الشهر الماضي" },
    votes: 144,
  },
  {
    id: "hof-5",
    name: { en: "Liam Brown", ar: "ليام براون" },
    country: { en: "UK", ar: "المملكة المتحدة" },
    countryFlag: "🇬🇧",
    image: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=600&auto=format&fit=crop&q=70",
    theme: { en: "Tiny Dragon", ar: "تنين صغير" },
    period: { en: "Last month", ar: "الشهر الماضي" },
    votes: 132,
  },
  {
    id: "hof-6",
    name: { en: "Aisha Noor", ar: "عائشة نور" },
    country: { en: "Pakistan", ar: "باكستان" },
    countryFlag: "🇵🇰",
    image: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&auto=format&fit=crop&q=70",
    theme: { en: "Starlight Garden", ar: "حديقة ضوء النجوم" },
    period: { en: "2 months ago", ar: "قبل شهرين" },
    votes: 121,
  },
];
