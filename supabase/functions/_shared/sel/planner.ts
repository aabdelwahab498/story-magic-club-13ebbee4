// Planner agent — converts (child, theme, focus) into a story blueprint
// (SPEC character, 4-act outline, SEL outcome contract, EQ skill).

import { aiJson } from "./gateway.ts";
import { AGE_BANDS, EQ_SKILLS, type AgeBand } from "./constants.ts";

export interface PlannerInput {
  childName: string;
  age: number;
  ageBand: AgeBand;
  theme: string;
  emotionalFocus: string[]; // e.g. ["shyness", "courage"]
  language: string; // "en" | "ar" | ...
  customPrompt?: string; // free-form user guidance — KB rules still win
}

export interface StoryBlueprint {
  title: string;
  hero: {
    name: string;
    age: number;
    sense: string; // visual signature (SPEC-S)
    problem: string; // inner flaw (SPEC-P)
    engine: string; // motivation (SPEC-E)
    charm: string; // likable quirk (SPEC-C)
    visibleFlaw: string;
    skinTone?: string;
    hair?: string;
    outfitColor?: string;
    signatureItem?: string;
  };
  mentor: { name: string; role: string };
  companion?: { name: string; role: string };
  challenger?: { name: string; nature: string }; // misunderstood obstacle for <8
  acts: {
    act1_normalWorld: string;
    act2_disturbance: string;
    act3_attempts: string[]; // Yes-but / No-and ladder, 3-5 entries
    act4_resolution: string;
  };
  selOutcome: {
    skill: string; // Goleman EQ skill
    emotion: string; // primary emotion experienced
    statement: string; // "After reading, the child will be able to [skill] when feeling [emotion]"
  };
  bibliotherapyMap: {
    identification: string;
    catharsis: string;
    insight: string;
    universalization: string;
  };
  dominantEmotion: string;
}

export async function planStory(input: PlannerInput): Promise<StoryBlueprint> {
  const band = AGE_BANDS[input.ageBand];
  const requestedBrief = input.customPrompt?.trim().slice(0, 800) ?? "";
  const system =
    `You are a senior children's literature planner trained in Bowlby attachment, Piaget cognitive stages, Vygotsky ZPD, Goleman EQ, and bibliotherapy. ` +
    `You ONLY return valid JSON matching the requested schema. No prose.`;
  const user = `Plan a children's story blueprint for the following child:
- Child name (hero shares this name): ${input.childName}
- Age: ${input.age} (Piaget band: ${band.piaget}, abstraction cap: ${band.abstractionCap})
- Theme: ${input.theme}
- Emotional focus areas: ${requestedBrief ? "Infer only what supports the user brief; do not replace the requested plot" : input.emotionalFocus.join(", ") || "general SEL"}
- Story language: ${input.language}
${requestedBrief ? `\n=== USER STORY BRIEF (BINDING — THIS IS THE PLOT) ===\n"""${requestedBrief}"""\n\nYou MUST honor every concrete element the user described: characters (names, species, relationships), setting, central event/relationship, and arc. The title and all 4 acts must clearly be ABOUT this brief. Adapt only what would violate the safety/age rules below; never replace the user's premise with a different story. If the user named a companion animal (e.g., chick, puppy), that companion must be central — not a generic mentor.\nIf the brief says a girl becomes big / older / stronger, plan that exact arc concretely and safely; do not turn it into a garden, boxes, or unrelated exploration story.\n=== END USER BRIEF ===\n` : ""}

REQUIREMENTS:
1. Hero must use SPEC technique (Sense, Problem, Engine, Charm) and have ONE visible flaw the child can recognize. If the user brief named the hero, USE THAT NAME; otherwise use "${input.childName}".
2. Mentor = safe-base figure. For age <8 the Challenger must be a misunderstood obstacle, NEVER pure villain.
3. 4-act structure with a Yes-but/No-and attempt ladder of 3-5 attempts in act 3.
4. SEL outcome must follow the contract: "After reading, the child will be able to [skill] when feeling [emotion]". Use exactly one Goleman EQ skill from: ${EQ_SKILLS.join(", ")}.
5. Map all 4 bibliotherapy stages (identification, catharsis, insight, universalization) to concrete moments in the story.
6. Hero MUST solve the climax themselves (with mentor support, not rescue).
7. Avoid for this age band: ${band.avoid.join(", ")}.
8. LANGUAGE LOCK: Every human-readable string in the JSON (title, hero.name unless brief specifies otherwise, mentor/companion/challenger names and roles, all acts, selOutcome.statement, bibliotherapyMap.*, dominantEmotion) MUST be written natively in ${input.language === "ar" ? "Arabic" : input.language === "en" ? "English" : input.language === "de" ? "German" : input.language === "fr" ? "French" : input.language === "it" ? "Italian" : input.language === "es" ? "Spanish" : input.language}. Do NOT mix languages. Schema KEYS stay English; VALUES in target language.
9. TITLE RULE: The title MUST literally name the hero and the central event/object from ${requestedBrief ? "the user brief" : "the theme"}, in the target language. Generic titles are forbidden.
${requestedBrief ? `10. USER-BRIEF MATCH CHECK: title + act1 + act2 + act3_attempts + act4 must each contain the concrete nouns from this brief: "${requestedBrief}". If the brief mentions a cat/dog/sibling/object, those words must appear in those fields.` : ""}

Return ONLY a JSON object with keys: title, hero{name,age,sense,problem,engine,charm,visibleFlaw,skinTone,hair,outfitColor,signatureItem}, mentor{name,role}, companion{name,role}, challenger{name,nature}, acts{act1_normalWorld,act2_disturbance,act3_attempts[],act4_resolution}, selOutcome{skill,emotion,statement}, bibliotherapyMap{identification,catharsis,insight,universalization}, dominantEmotion.`;

  return await aiJson<StoryBlueprint>({
    system,
    user,
    temperature: requestedBrief ? 0.2 : 0.8,
    maxTokens: 2500,
  });
}
