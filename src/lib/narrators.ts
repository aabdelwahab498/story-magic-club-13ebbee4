// Shared narrator metadata used across AI Storyteller and Story Library.
// Keep this in sync with src/components/NarratorAvatar.tsx and browserTts.ts.

// Optimized WebP versions — ~99% smaller than the originals (under 15KB each).
import wizardImg from "@/assets/wizard-narrator.webp";
import fairyImg from "@/assets/fairy-narrator.webp";
import robotImg from "@/assets/robot-narrator.webp";
import dragonImg from "@/assets/dragon-narrator.webp";
import alienImg from "@/assets/alien-narrator.webp";

export const NARRATOR_KEYS = [
  "wizard",
  "fairy",
  "robot",
  "dragon",
  "alien",
] as const;

export type NarratorId = (typeof NARRATOR_KEYS)[number];

export const NARRATOR_IMAGES: Record<NarratorId, string> = {
  wizard: wizardImg,
  fairy: fairyImg,
  robot: robotImg,
  dragon: dragonImg,
  alien: alienImg,
};

// Accent color per narrator (used for chips/rings)
export const NARRATOR_COLORS: Record<NarratorId, string> = {
  wizard: "#8B5CF6",
  fairy: "#FF9AD5",
  robot: "#78CEFF",
  dragon: "#FFB347",
  alien: "#7BEDAD",
};
