// Local (offline) story generator. Zero external calls.
// Used when every AI provider is down, rate-limited, out of credits,
// or times out. Produces a safe 3-page teaser that always works.

import type { StoryBlueprint } from "./planner.ts";
import type { WrittenStory } from "./writer.ts";
import type { AgeBand } from "./constants.ts";

interface ThemePack {
  hero_sense: string;
  setting: string;
  companion: string;
  challenge: string;
  emotionTags: [string, string, string];
}

const THEME_PACKS_EN: Record<string, ThemePack> = {
  adventure: {
    hero_sense: "bright eyes and a brave little smile",
    setting: "a winding forest path filled with whispering trees",
    companion: "a kind firefly named Lumi",
    challenge: "a tricky bridge that creaks in the wind",
    emotionTags: ["wonder", "courage", "calm"],
  },
  animals: {
    hero_sense: "soft hands and a gentle laugh",
    setting: "a sunny meadow where rabbits hop and birds sing",
    companion: "a curious fox cub named Pip",
    challenge: "a baby bird who has lost its way",
    emotionTags: ["empathy", "belonging", "joy"],
  },
  space: {
    hero_sense: "starlit eyes and floating curls",
    setting: "a quiet moon garden under a sky full of stars",
    companion: "a friendly little robot named Beep",
    challenge: "a tiny shooting star that needs help going home",
    emotionTags: ["wonder", "courage", "calm"],
  },
  fantasy: {
    hero_sense: "a sparkling cape and a hopeful heart",
    setting: "a castle of clouds with rainbow stairs",
    companion: "a tiny dragon named Ember",
    challenge: "a wish that has gotten tangled in the sky",
    emotionTags: ["wonder", "belonging", "joy"],
  },
  underwater: {
    hero_sense: "shimmery hair and a curious smile",
    setting: "a coral garden where seahorses dance",
    companion: "a clever little turtle named Coco",
    challenge: "a pearl that has rolled into a dark cave",
    emotionTags: ["calm", "courage", "joy"],
  },
};

const THEME_PACKS_AR: Record<string, ThemePack> = {
  adventure: {
    hero_sense: "بعينين لامعتين وابتسامة شجاعة",
    setting: "طريق صغير في غابة تهمس فيها الأشجار",
    companion: "يراعة لطيفة اسمها لومي",
    challenge: "جسر صغير يهتز مع نسيم الليل",
    emotionTags: ["wonder", "courage", "calm"],
  },
  animals: {
    hero_sense: "بيدين ناعمتين وقلب رقيق",
    setting: "مرج مشمس فيه أرانب صغيرة وعصافير تغني",
    companion: "ثعلب صغير فضولي اسمه بيب",
    challenge: "عصفور صغير تاه عن أمه",
    emotionTags: ["empathy", "belonging", "joy"],
  },
  space: {
    hero_sense: "بعيون مليانة نجوم وشعر طاير",
    setting: "حديقة قمرية هادية تحت سماء مليانة نجوم",
    companion: "روبوت صغير لطيف اسمه بيب",
    challenge: "نجم صغير تاه وعايز يرجع بيته",
    emotionTags: ["wonder", "courage", "calm"],
  },
  fantasy: {
    hero_sense: "بعباءة لامعة وقلب مليان أمل",
    setting: "قلعة من سحاب لها سلالم قوس قزح",
    companion: "تنين صغير لطيف اسمه إمبر",
    challenge: "أمنية صغيرة اتلفت في السحاب",
    emotionTags: ["wonder", "belonging", "joy"],
  },
  underwater: {
    hero_sense: "بشعر يلمع وابتسامة فضولية",
    setting: "حديقة مرجانية فيها أحصنة بحر بترقص",
    companion: "سلحفاة صغيرة شاطرة اسمها كوكو",
    challenge: "لؤلؤة صغيرة دحرجت في كهف غامق",
    emotionTags: ["calm", "courage", "joy"],
  },
};

function pickPack(theme: string, lang: string): ThemePack {
  const t = (theme || "").toLowerCase();
  const dict = lang.startsWith("ar") ? THEME_PACKS_AR : THEME_PACKS_EN;
  for (const key of Object.keys(dict)) {
    if (t.includes(key) || t.includes(key.slice(0, 4))) return dict[key];
  }
  // Default
  return dict.adventure;
}

export interface LocalGenInput {
  childName: string;
  age: number;
  ageBand: AgeBand;
  theme: string;
  language: string;
}

export function localBlueprint(input: LocalGenInput): StoryBlueprint {
  const pack = pickPack(input.theme, input.language);
  const isAr = input.language.startsWith("ar");
  const title = isAr
    ? `${input.childName} و${pack.companion.split(" ").slice(-1)[0]}`
    : `${input.childName} and ${pack.companion.split(" ").slice(-1)[0]}`;

  return {
    title,
    hero: {
      name: input.childName,
      age: input.age,
      sense: pack.hero_sense,
      problem: isAr ? "بيخاف يجرب حاجة جديدة لوحده" : "feels a little shy to try something new alone",
      engine: isAr ? "عايز يساعد صحابه" : "wants to help a friend in need",
      charm: isAr ? "بيضحك بصوت عالي" : "has the warmest laugh",
      visibleFlaw: isAr ? "بيتردد قبل ما يقرر" : "hesitates before taking the first step",
    },
    mentor: {
      name: isAr ? "ستي القمر" : "Grandma Moon",
      role: isAr ? "صوت لطيف بيطمن البطل" : "a gentle, safe-base voice that reassures the hero",
    },
    companion: {
      name: pack.companion,
      role: isAr ? "صاحب وفي" : "loyal little friend",
    },
    acts: {
      act1_normalWorld: isAr
        ? `${input.childName} في ${pack.setting} بيلعب مع ${pack.companion}.`
        : `${input.childName} plays peacefully in ${pack.setting} with ${pack.companion}.`,
      act2_disturbance: isAr
        ? `فجأة لقوا ${pack.challenge}.`
        : `Suddenly they discover ${pack.challenge}.`,
      act3_attempts: [
        isAr ? "حاولوا الأول لوحدهم وما عرفوش" : "They try alone but it feels too big",
        isAr ? "أخدوا نفس عميق وفكروا تاني" : "They take a deep breath and think together",
        isAr ? "اتعاونوا وكل واحد عمل خطوة صغيرة" : "They cooperate, each taking one small step",
      ],
      act4_resolution: isAr
        ? `${input.childName} حل المشكلة بنفسه بمساعدة صحابه، ورجعوا البيت مبسوطين.`
        : `${input.childName} solves the problem themselves with help from friends, and they return home happy.`,
    },
    selOutcome: {
      skill: "self-regulation",
      emotion: pack.emotionTags[1],
      statement: isAr
        ? `بعد القصة، ${input.childName} هيقدر ياخد نفس ويحاول لما يحس بالتردد.`
        : `After reading, ${input.childName} will be able to pause, breathe, and try again when feeling unsure.`,
    },
    bibliotherapyMap: {
      identification: isAr ? "الطفل يشوف نفسه في تردد البطل" : "Child sees themselves in the hero's hesitation",
      catharsis: isAr ? "البطل يسمي إحساسه" : "Hero names the feeling out loud",
      insight: isAr ? "البطل يكتشف إن الخطوة الصغيرة بتساعد" : "Hero discovers small steps help",
      universalization: isAr ? "كل الأصدقاء بيحسوا بكدا أحياناً" : "All friends feel this way sometimes",
    },
    dominantEmotion: pack.emotionTags[1],
  };
}

export function localStory(input: LocalGenInput): WrittenStory {
  const bp = localBlueprint(input);
  const pack = pickPack(input.theme, input.language);
  const isAr = input.language.startsWith("ar");
  const name = input.childName;

  const pages = isAr
    ? [
        {
          index: 1,
          text: `كان فيه طفل اسمه ${name}، ${bp.hero.sense}. في يوم لطيف، راح ${pack.setting}. النسمة كانت بتغني بهدوء حواليه.`,
          emotionTag: pack.emotionTags[0],
          illustrationPrompt: `${name} smiling in ${pack.setting}, soft pastel lighting`,
          bibliotherapyStage: "identification" as const,
        },
        {
          index: 2,
          text: `فجأة، ${name} لقى ${pack.challenge}. قلبه دق بسرعة. أخد نفس عميق وقال لنفسه: "أنا أقدر، خطوة خطوة."`,
          emotionTag: pack.emotionTags[1],
          illustrationPrompt: `${name} taking a deep breath, gentle warm light, ${pack.setting}`,
          bibliotherapyStage: "catharsis" as const,
        },
        {
          index: 3,
          text: `بمساعدة ${pack.companion}، ${name} حل المشكلة بهدوء وفرحة. ابتسم، ورجع البيت والنجوم بتلمع فوقه زي همسة دافية.`,
          emotionTag: pack.emotionTags[2],
          illustrationPrompt: `${name} walking home under starlight, calm warm palette`,
          bibliotherapyStage: "universalization" as const,
        },
      ]
    : [
        {
          index: 1,
          text: `There once was a child named ${name}, with ${bp.hero.sense}. One gentle day, ${name} wandered into ${pack.setting}. The breeze hummed a soft little song all around.`,
          emotionTag: pack.emotionTags[0],
          illustrationPrompt: `${name} smiling in ${pack.setting}, soft pastel lighting`,
          bibliotherapyStage: "identification" as const,
        },
        {
          index: 2,
          text: `Suddenly, ${name} noticed ${pack.challenge}. ${name}'s heart fluttered. Taking a slow, deep breath, ${name} whispered, "I can try, one small step at a time."`,
          emotionTag: pack.emotionTags[1],
          illustrationPrompt: `${name} breathing deeply, gentle warm light, ${pack.setting}`,
          bibliotherapyStage: "catharsis" as const,
        },
        {
          index: 3,
          text: `With ${pack.companion} close beside, ${name} solved it kindly and calmly. ${name} smiled, and walked home as the stars twinkled above like a warm, soft hush.`,
          emotionTag: pack.emotionTags[2],
          illustrationPrompt: `${name} walking home under starlight, calm warm palette`,
          bibliotherapyStage: "universalization" as const,
        },
      ];

  return { title: bp.title, pages };
}
