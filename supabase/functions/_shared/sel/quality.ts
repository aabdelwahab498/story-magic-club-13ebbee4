// Quality judge — LLM-based rubric scoring (5 axes × 5 = /25). Pass ≥ 18.

import { aiJson } from "./gateway.ts";
import { QUALITY_AXES, QUALITY_PASS_THRESHOLD, IBBY_CRITERIA, BIBLIOTHERAPY_STAGES } from "./constants.ts";
import type { WrittenStory } from "./writer.ts";
import type { StoryBlueprint } from "./planner.ts";

export interface QualityReport {
  scores: Record<string, number>; // axis → 0..5
  total: number; // 0..25
  passed: boolean;
  ibbyCheck: Record<string, boolean>;
  bibliotherapyPresent: Record<string, boolean>;
  notes: string;
  issues: string[];
}

export async function judgeQuality(
  story: WrittenStory,
  blueprint: StoryBlueprint,
  customPrompt?: string,
): Promise<QualityReport> {
  const system =
    `You are a strict children's literature reviewer trained in IBBY/UNESCO criteria, ` +
    `Goleman EQ, bibliotherapy, and trauma-informed practice. You ONLY return valid JSON.`;

  const user = `Score the following children's story strictly.

STORY:
${JSON.stringify(story, null, 2)}

BLUEPRINT (intended):
${JSON.stringify(blueprint, null, 2)}

${customPrompt?.trim() ? `USER STORY BRIEF (must be matched):
"""${customPrompt.trim().slice(0, 800)}"""

If the story does not clearly preserve the brief's concrete characters, setting, central event, and resolution, cap structure-4act and sel-arc at 2 and add an issue named "brief-mismatch".
` : ""}

For each of these 5 axes give an integer 0..5:
${QUALITY_AXES.map((a) => `- ${a}`).join("\n")}

Also check:
- ibbyCheck: object with boolean per criterion: ${IBBY_CRITERIA.join(", ")}
- bibliotherapyPresent: object with boolean per stage: ${BIBLIOTHERAPY_STAGES.join(", ")}
- issues: array of short strings describing any problems (preaching, hopeless ending, hero rescued instead of solving, age-mismatch, stereotype, etc.)
- notes: one paragraph reviewer summary

Return ONLY JSON: { "scores": { "spec-character": int, "structure-4act": int, "age-fit": int, "sel-arc": int, "voice-safety": int }, "ibbyCheck": {...}, "bibliotherapyPresent": {...}, "issues": [...], "notes": "..." }`;

  const raw = await aiJson<Omit<QualityReport, "total" | "passed">>({
    system,
    user,
    temperature: 0.2,
    maxTokens: 1800,
  });
  const total = QUALITY_AXES.reduce((s, a) => s + (raw.scores?.[a] ?? 0), 0);
  return {
    ...raw,
    total,
    passed: total >= QUALITY_PASS_THRESHOLD,
  };
}
