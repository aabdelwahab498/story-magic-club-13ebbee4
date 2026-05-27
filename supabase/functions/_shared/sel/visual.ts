// Character visual hash — guarantees illustrator consistency across pages.
// Hash = stable string derived from SPEC visual fields.

import { COLOR_EMOTION_MAP } from "./constants.ts";

export interface CharacterVisual {
  name: string;
  age: number | string;
  skinTone?: string;
  hair?: string;
  outfitColor?: string;
  signatureItem?: string;
  dominantEmotion?: keyof typeof COLOR_EMOTION_MAP | string;
}

export function characterVisualHash(c: CharacterVisual): string {
  const parts = [
    c.name?.toLowerCase().trim(),
    `age:${c.age}`,
    c.skinTone && `skin:${c.skinTone}`,
    c.hair && `hair:${c.hair}`,
    c.outfitColor && `outfit:${c.outfitColor}`,
    c.signatureItem && `item:${c.signatureItem}`,
    c.dominantEmotion && `emo:${c.dominantEmotion}`,
  ].filter(Boolean);
  return parts.join("|");
}

export function colorPaletteFor(emotion?: string): string {
  if (!emotion) return COLOR_EMOTION_MAP.calm;
  return COLOR_EMOTION_MAP[emotion] ?? COLOR_EMOTION_MAP.calm;
}
