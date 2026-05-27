import type { Multilingual } from "./multilingual";

export interface StoreProduct {
  id: string;
  image: string;
  badge?: Multilingual;
  title: Multilingual;
  description: Multilingual;
  priceUsd: number;
  oldPriceUsd?: number;
}

const img = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=900&q=70`;

export const storeProducts: StoreProduct[] = [
  {
    id: "starter-3",
    image: img("1512820790803-83ca734da794"),
    badge: { en: "Starter", ar: "للمبتدئين" },
    title: {
      en: "Starter Bundle — 3 Printed Stories",
      ar: "باقة البداية — ٣ قصص مطبوعة",
    },
    description: {
      en: "Three of our most-loved bedtime stories, beautifully printed on premium paper. Perfect first gift.",
      ar: "ثلاث من أحب قصصنا لما قبل النوم، مطبوعة بشكل أنيق على ورق فاخر. هدية أولى مثالية.",
    },
    priceUsd: 19,
  },
  {
    id: "family-5",
    image: img("1481627834876-b7833e8f5570"),
    badge: { en: "Most popular ⭐", ar: "الأكثر مبيعاً ⭐" },
    title: {
      en: "Family Bundle — 5 Printed Stories",
      ar: "باقة العائلة — ٥ قصص مطبوعة",
    },
    description: {
      en: "Five hand-picked adventures with hardcover binding and a custom name page for your child.",
      ar: "خمس مغامرات مختارة بعناية مع تغليف فاخر وصفحة اسم مخصصة لطفلك.",
    },
    priceUsd: 29,
    oldPriceUsd: 39,
  },
  {
    id: "ultimate-50",
    image: img("1507842217343-583bb7270b66"),
    badge: { en: "Best value", ar: "أفضل قيمة" },
    title: {
      en: "Ultimate Bundle — Up to 50 Pages",
      ar: "الباقة الكبرى — حتى ٥٠ صفحة",
    },
    description: {
      en: "Build your own up-to-50-page hardcover book from any stories in our library. Fully personalized.",
      ar: "صمّم كتابك الفاخر حتى ٥٠ صفحة من أي قصص في مكتبتنا. مخصص بالكامل.",
    },
    priceUsd: 49,
  },
  {
    id: "ai-printed",
    image: img("1488646953014-85cb44e25828"),
    badge: { en: "New ✨", ar: "جديد ✨" },
    title: {
      en: "Print Your AI Story",
      ar: "اطبع قصتك من الذكاء الاصطناعي",
    },
    description: {
      en: "Turn any AI-generated story into a printed keepsake with custom illustrations.",
      ar: "حوّل أي قصة من الذكاء الاصطناعي إلى تذكار مطبوع برسومات مخصصة.",
    },
    priceUsd: 25,
  },
];
