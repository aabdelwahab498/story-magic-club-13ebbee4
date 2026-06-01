// Writer agent — turns blueprint into 10-15 page structured story.

import { aiJson } from "./gateway.ts";
import { AGE_BANDS, type AgeBand } from "./constants.ts";
import type { StoryBlueprint } from "./planner.ts";

export interface StoryPage {
  index: number;
  text: string;
  emotionTag: string; // primary emotion on this page (drives illustrator color palette)
  illustrationPrompt: string; // concise scene description for image gen
  bibliotherapyStage?: "identification" | "catharsis" | "insight" | "universalization";
  // Cinematic multimedia director fields (optional, age-safe)
  visualPrompt?: string;       // highly detailed cinematic image prompt
  animationPrompt?: string;    // camera move, character motion, lighting, atmosphere
  voiceOver?: string;          // warm narrator line for this scene
  dialogue?: string;           // character dialogue only (may be empty)
  soundEffects?: string;       // diegetic sfx list (footsteps, wind, sparkle…)
  backgroundMusic?: string;    // music style + emotional mood
  imagePrompt?: string;        // optimized for Midjourney / DALL·E / Leonardo
  videoPrompt?: string;        // optimized for Runway / Kling / Pika / Sora
}

export interface WrittenStory {
  title: string;
  pages: StoryPage[];
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
};

export interface WriterSettings {
  model?: string;
  temperature?: number;
  systemPromptOverride?: string | null;
  userPromptAddendum?: string | null;
  visualStyle?: string;
  cinematicFields?: Record<string, boolean>;
  bannedWords?: string[];
  customPrompt?: string;
}

export async function writeStory(
  blueprint: StoryBlueprint,
  ageBand: AgeBand,
  language: string,
  settings: WriterSettings = {},
): Promise<WrittenStory> {
  const band = AGE_BANDS[ageBand];
  const langName = LANG_NAMES[language] ?? "English";
  const targetPages = band.pages[0];
  const visualStyle = settings.visualStyle || "Pixar/Ghibli";
  const fields = settings.cinematicFields || {};
  const enabled = (k: string) => fields[k] !== false; // default ON if unspecified

  const baseSystem =
    `You are a master children's author AND a cinematic multimedia director. You write ALL prose, dialogue, narration, and titles 100% in ${langName} — never mix languages, never transliterate, never insert another language for "flavor". ` +
    `You follow the 1-meter-tall rule (write from the child's eye level). ` +
    `Every page ends with a soft emotional hook. The first sentence is a sensory hook tied to the story's actual subject. ` +
    `The last sentence is a peaceful echo of the message — never a stated moral. ` +
    `Validate feelings; never use "must" or "should". ` +
    `Visual style for prompts: warm ${visualStyle}-inspired children's illustration, soft cinematic lighting, NEVER photoreal, NEVER scary. ` +
    `All multimedia fields must be age-safe (no violence, horror, romance, weapons, blood). ` +
    (settings.bannedWords && settings.bannedWords.length
      ? `Forbidden words/topics (never use): ${settings.bannedWords.join(", ")}. `
      : "") +
    `You ONLY return valid JSON.`;

  const system = settings.systemPromptOverride?.trim()
    ? settings.systemPromptOverride
    : baseSystem;

  const requestedBrief = settings.customPrompt?.trim().slice(0, 800) ?? "";
  const user = `Turn this blueprint into a structured ${targetPages}-page cinematic story (${band.pages[0]}-${band.pages[1]} pages allowed).

OUTPUT LANGUAGE (HARD LOCK): ${langName}. Every value of text, voiceOver, dialogue, illustrationPrompt, and the title MUST be in ${langName}. JSON keys stay English. If you produce any value in a different language, the answer is invalid — rewrite it.

TITLE RULE: Use EXACTLY the blueprint's title ("${blueprint.title}") unless it is not in ${langName} — in that case translate it faithfully to ${langName} keeping the same characters and event. Never invent a new unrelated title.

SUBJECT LOCK: The story's hero is "${blueprint.hero.name}". The central conflict is described in acts.act2_disturbance and resolved in acts.act4_resolution. Every page MUST visibly belong to THIS story — the hero's name, the setting, and the central event from the blueprint must appear across the pages. Do NOT write a generic bakery/garden/forest scene that ignores the blueprint.

BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}
${requestedBrief ? `\n=== USER STORY BRIEF (BINDING — THE STORY MUST BE ABOUT THIS) ===\n"""${requestedBrief}"""\nEvery scene must clearly belong to the user's brief. Keep the characters they named (by name), the relationship they described, the setting, and the central arc. The hero's name and the key noun(s) from the brief MUST appear on page 1 and recur through the story. Do NOT replace it with a generic adventure.\n=== END USER BRIEF ===\n` : ""}

PAGE / SCENE RULES:
- text: ${band.sentencesPerPage[0]}-${band.sentencesPerPage[1]} sentences per page, each sentence ${band.sentenceWords[0]}-${band.sentenceWords[1]} words, in ${langName}.
- emotionTag: primary emotion (wonder, courage, calm, sadness, joy, belonging, fear-with-comfort).
- bibliotherapyStage: tag the right pages so all 4 stages appear in order (identification → catharsis → insight → universalization).
- illustrationPrompt: 1 short sentence, consistent with hero's visual signature.
- The hero MUST resolve the climax themselves. Mentor supports, never rescues.
- End with a peaceful sensory closing in ${langName}.
- SELF-CHECK before returning: (a) title matches the blueprint and is in ${langName}; (b) hero "${blueprint.hero.name}" is named on page 1; (c) the central event from acts.act2_disturbance is present by page 2-3; (d) climax matches acts.act4_resolution; (e) no sentence is in a language other than ${langName}. If any check fails, rewrite before returning.
${requestedBrief ? `- USER-BRIEF MATCH CHECK: title, page 1, climax, and resolution must each contain the concrete nouns from: "${requestedBrief}".` : ""}

CINEMATIC MULTIMEDIA FIELDS (include ONLY the enabled ones below, age-appropriate):
${enabled("visualPrompt") ? "- visualPrompt: a rich cinematic image description — character (consistent), setting, props, lighting, color palette tied to emotionTag, camera framing.\n" : ""}${enabled("animationPrompt") ? "- animationPrompt: camera movement (slow push-in, gentle pan, parallax), character movement, atmosphere, lighting changes.\n" : ""}${enabled("voiceOver") ? `- voiceOver: 1–2 short narrator lines in ${langName}, warm storytelling tone.\n` : ""}${enabled("dialogue") ? `- dialogue: short character dialogue in ${langName} ("" if none).\n` : ""}${enabled("soundEffects") ? "- soundEffects: comma-separated diegetic sounds. NO scary or violent sfx.\n" : ""}${enabled("backgroundMusic") ? "- backgroundMusic: music style + emotional mood.\n" : ""}${enabled("imagePrompt") ? "- imagePrompt: one-line prompt optimized for Midjourney / DALL·E / Leonardo.\n" : ""}${enabled("videoPrompt") ? "- videoPrompt: one-line prompt optimized for Runway / Kling / Pika / Sora.\n" : ""}
Keep visual + character consistency across all scenes (same hero look, same color motifs).
${settings.userPromptAddendum ? `\nADDITIONAL ADMIN INSTRUCTIONS:\n${settings.userPromptAddendum}\n` : ""}
Return ONLY JSON: { "title": string, "pages": [ { "index": 1, "text": "...", "emotionTag": "...", "illustrationPrompt": "...", "bibliotherapyStage": "identification|catharsis|insight|universalization"${enabled("visualPrompt") ? ', "visualPrompt": "..."' : ""}${enabled("animationPrompt") ? ', "animationPrompt": "..."' : ""}${enabled("voiceOver") ? ', "voiceOver": "..."' : ""}${enabled("dialogue") ? ', "dialogue": "..."' : ""}${enabled("soundEffects") ? ', "soundEffects": "..."' : ""}${enabled("backgroundMusic") ? ', "backgroundMusic": "..."' : ""}${enabled("imagePrompt") ? ', "imagePrompt": "..."' : ""}${enabled("videoPrompt") ? ', "videoPrompt": "..."' : ""} } ] }`;

  return await aiJson<WrittenStory>({
    system,
    user,
    model: settings.model,
    temperature: settings.temperature ?? (requestedBrief ? 0.55 : 0.85),
    maxTokens: 6000,
  });
}
