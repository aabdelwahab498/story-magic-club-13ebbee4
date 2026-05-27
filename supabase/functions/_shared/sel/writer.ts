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
    `You are a master children's author AND a cinematic multimedia director. You write entirely in ${langName}. ` +
    `You follow the 1-meter-tall rule (write from the child's eye level). ` +
    `Every page ends with a soft emotional hook. The first sentence is a sensory hook. ` +
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
  const user = `Turn this blueprint into a structured ${targetPages}-page cinematic story (${band.pages[0]}-${band.pages[1]} pages allowed):

BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}
${requestedBrief ? `\n=== USER STORY BRIEF (BINDING — THE STORY MUST BE ABOUT THIS) ===\n"""${requestedBrief}"""\nEvery scene must clearly belong to the user's brief. Keep the characters they named, the relationship they described, and the central arc. Do NOT replace it with a generic adventure.\nIf the brief asks for a girl, boy, named child, animal friend, sibling, or specific transformation, those exact concrete elements MUST appear from page 1 and drive the plot.\nDo not use a different generic setting or conflict unless it is explicitly in the brief.\n=== END USER BRIEF ===\n` : ""}

PAGE / SCENE RULES:
- text: ${band.sentencesPerPage[0]}-${band.sentencesPerPage[1]} sentences per page, each sentence ${band.sentenceWords[0]}-${band.sentenceWords[1]} words, in ${langName}.
- emotionTag: primary emotion (wonder, courage, calm, sadness, joy, belonging, fear-with-comfort).
- bibliotherapyStage: tag the right pages so all 4 stages appear in order (identification → catharsis → insight → universalization).
- illustrationPrompt: 1 short sentence, consistent with hero's visual signature.
- The hero MUST resolve the climax themselves. Mentor supports, never rescues.
- End with a peaceful sensory closing in ${langName}.
${requestedBrief ? `- USER-BRIEF MATCH CHECK: Before returning JSON, silently verify the title, first page, climax, and resolution all clearly match: "${requestedBrief}". If not, rewrite them now.` : ""}

CINEMATIC MULTIMEDIA FIELDS (include ONLY the enabled ones below, age-appropriate):
${enabled("visualPrompt") ? "- visualPrompt: a rich cinematic image description — character (consistent), setting, props, lighting, color palette tied to emotionTag, camera framing.\n" : ""}${enabled("animationPrompt") ? "- animationPrompt: camera movement (slow push-in, gentle pan, parallax), character movement, atmosphere, lighting changes.\n" : ""}${enabled("voiceOver") ? `- voiceOver: 1–2 short narrator lines in ${langName}, warm storytelling tone.\n` : ""}${enabled("dialogue") ? `- dialogue: short character dialogue in ${langName} ("" if none).\n` : ""}${enabled("soundEffects") ? "- soundEffects: comma-separated diegetic sounds. NO scary or violent sfx.\n" : ""}${enabled("backgroundMusic") ? "- backgroundMusic: music style + emotional mood.\n" : ""}${enabled("imagePrompt") ? "- imagePrompt: one-line prompt optimized for Midjourney / DALL·E / Leonardo.\n" : ""}${enabled("videoPrompt") ? "- videoPrompt: one-line prompt optimized for Runway / Kling / Pika / Sora.\n" : ""}
Keep visual + character consistency across all scenes (same hero look, same color motifs).
${settings.userPromptAddendum ? `\nADDITIONAL ADMIN INSTRUCTIONS:\n${settings.userPromptAddendum}\n` : ""}
Return ONLY JSON: { "title": string, "pages": [ { "index": 1, "text": "...", "emotionTag": "...", "illustrationPrompt": "...", "bibliotherapyStage": "identification|catharsis|insight|universalization"${enabled("visualPrompt") ? ', "visualPrompt": "..."' : ""}${enabled("animationPrompt") ? ', "animationPrompt": "..."' : ""}${enabled("voiceOver") ? ', "voiceOver": "..."' : ""}${enabled("dialogue") ? ', "dialogue": "..."' : ""}${enabled("soundEffects") ? ', "soundEffects": "..."' : ""}${enabled("backgroundMusic") ? ', "backgroundMusic": "..."' : ""}${enabled("imagePrompt") ? ', "imagePrompt": "..."' : ""}${enabled("videoPrompt") ? ', "videoPrompt": "..."' : ""} } ] }`;

  return await aiJson<WrittenStory>({
    system,
    user,
    model: settings.model,
    temperature: settings.temperature ?? 0.85,
    maxTokens: 5000,
  });
}
