// SEL constants — derived from docs/CHILDRENS_LITERATURE_KNOWLEDGE_BASE.md
// Single source of truth. Do not duplicate elsewhere.

export const AGE_BANDS = {
  "3-5": {
    piaget: "preoperational",
    sentenceWords: [5, 8] as [number, number],
    pages: [10, 12] as [number, number],
    sentencesPerPage: [1, 2] as [number, number],
    abstractionCap: "concrete-only",
    avoid: ["fear", "loss-of-caregiver", "death", "violence", "shame"],
  },
  "6-8": {
    piaget: "concrete-operational-early",
    sentenceWords: [8, 14] as [number, number],
    pages: [11, 14] as [number, number],
    sentencesPerPage: [1, 2] as [number, number],
    abstractionCap: "simple-cause-effect",
    avoid: ["graphic-fear", "romance", "violence", "preaching"],
  },
  "9-12": {
    piaget: "concrete-operational-late",
    sentenceWords: [10, 20] as [number, number],
    pages: [12, 15] as [number, number],
    sentencesPerPage: [1, 3] as [number, number],
    abstractionCap: "limited-abstract",
    avoid: ["romance", "violence", "hopelessness", "preaching"],
  },
} as const;

export type AgeBand = keyof typeof AGE_BANDS;

// Goleman EQ skills — at least one must be tagged per story
export const EQ_SKILLS = [
  "self-awareness",
  "self-regulation",
  "motivation",
  "empathy",
  "social-skills",
] as const;

// Trauma-Informed reject list (Part 3 — must NEVER appear)
export const TRAUMA_REJECT = [
  "shame-language", // "you should be ashamed", "bad child"
  "preaching-moral", // explicit "the lesson is..."
  "hopeless-ending",
  "stereotype", // gender, race, ability
  "fear-marketing", // "if you don't X, Y bad thing"
  "adult-always-savior", // hero never solves anything
  "punishment-as-resolution",
] as const;

// IBBY + UNESCO 6 criteria
export const IBBY_CRITERIA = [
  "respects-child-dignity",
  "culturally-inclusive",
  "age-appropriate-language",
  "promotes-empathy",
  "free-of-stereotypes",
  "hopeful-resolution",
] as const;

// Color → emotion map (for illustrator pipeline)
export const COLOR_EMOTION_MAP: Record<string, string> = {
  joy: "warm-yellow,coral",
  calm: "soft-blue,lavender",
  courage: "deep-red,gold",
  sadness: "muted-blue,grey",
  wonder: "violet,starlight-white",
  belonging: "warm-amber,sage-green",
  fear: "indigo-with-gentle-light", // never pure black
};

// Bibliotherapy 4-stage arc (must all 4 appear in sequence)
export const BIBLIOTHERAPY_STAGES = [
  "identification", // child sees themselves in hero
  "catharsis", // hero feels and names the emotion
  "insight", // hero finds a way through
  "universalization", // child realizes "others feel this too"
] as const;

// Quality rubric — 5 axes × 5 points = /25. Pass ≥ 18.
export const QUALITY_PASS_THRESHOLD = 18;
export const QUALITY_AXES = [
  "spec-character", // SPEC + visible flaw
  "structure-4act", // 4-act + Yes-but/No-and
  "age-fit", // Piaget + sentence/page targets
  "sel-arc", // bibliotherapy 4 stages + EQ skill
  "voice-safety", // validates first, no preach, hopeful echo
] as const;
