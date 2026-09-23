import { Injectable } from '@nestjs/common';
import { StoryContext } from '../context/story-context.interface.js';
import { GeneratedPrompt } from './generated-prompt.interface.js';
import { StoryPlan } from '../interfaces/story-plan.interface.js';
import { StoryContract } from '../director/story-contract.interface.js';

@Injectable()
export class PromptBuilder {
  buildPlannerPrompt(context: StoryContext & { contract?: StoryContract; correctionContext?: string }): GeneratedPrompt {
    const systemPrompt = `You are Najmah, an expert children's story planner. Your job is to create a structured story plan that adheres to the Najmah AI Story Constitution. Do not generate the story text itself, only the blueprint.`;

    const emotionalFocusStr = context.emotionalFocus?.length
      ? `\nEmotional Focus Goals: ${context.emotionalFocus.join(', ')}`
      : '';
    const childNameStr = context.childName ? `\nChild Name: ${context.childName}` : '';

    let customBriefBlock = '';
    if (context.customPrompt) {
      const contractConstraints = context.contract?.hardConstraints?.length
        ? `\nHARD CONSTRAINTS:\n- ${context.contract.hardConstraints.join('\n- ')}`
        : '';
      customBriefBlock = `\nPRIMARY STORY BRIEF / PREMISE (USER REQUEST):\n"${context.customPrompt}"\n${contractConstraints}\n\nIMPORTANT: Treat this Primary Story Brief as the core story premise and primary direction. Preserve user-specified protagonist details, setting, key characters/objects, and plot direction. Theme and SEL Goal should guide and enrich this premise, not replace it. CRITICAL DIRECTIVE: You MUST NOT substitute another protagonist (such as Leo or Pip) or invent an unrelated narrative template.`;
    }

    const correctionBlock = context.correctionContext
      ? `\n\nCORRECTIVE FEEDBACK FROM STORY GUARDIAN:\n${context.correctionContext}\nYou MUST fix these issues in the generated blueprint.`
      : '';

    const userPrompt = `
Create a story plan for a ${context.targetAge}-year-old child.${childNameStr}
Language: ${context.language}
Reading Level: ${context.readingLevel}
Theme: ${context.theme}
SEL Goal: ${context.selGoal}${emotionalFocusStr}${customBriefBlock}${correctionBlock}

Output a JSON object matching this structure:
{
  "title": "Story Title",
  "characters": [{ "name": "Name", "role": "hero|mentor|companion", "description": "Desc" }],
  "conflict": "The main problem",
  "resolution": "How the problem is solved using the SEL goal",
  "selGoals": ["${context.selGoal}"],
  "pageCount": 5
}
    `.trim();

    return { systemPrompt, userPrompt };
  }

  buildWriterPrompt(
    context: StoryContext & { contract?: StoryContract; correctionContext?: string },
    plan: StoryPlan,
  ): GeneratedPrompt {
    const systemPrompt = `You are Najmah, an expert children's story writer. Write the story content based on the provided blueprint. Ensure the text is engaging and strictly adheres to the given reading level and SEL goal.`;

    const emotionalFocusStr = context.emotionalFocus?.length
      ? `\nEmotional Focus Goals: ${context.emotionalFocus.join(', ')}`
      : '';
    const childNameStr = context.childName ? `\nChild Name: ${context.childName}` : '';
    const customPromptStr = context.customPrompt
      ? `\nPRIMARY STORY BRIEF / PREMISE (PRIMARY SOURCE OF TRUTH):\n"${context.customPrompt}"\nYou MUST write about the requested protagonist (${plan.characters?.[0]?.name || 'hero'}) and central adventure in the brief.`
      : '';

    const correctionBlock = context.correctionContext
      ? `\n\nCORRECTIVE FEEDBACK:\n${context.correctionContext}`
      : '';

    const userPrompt = `
Write a ${plan.pageCount}-page story.
Target Age: ${context.targetAge}${childNameStr}
Reading Level: ${context.readingLevel}
Language: ${context.language}${emotionalFocusStr}${customPromptStr}${correctionBlock}

Blueprint:
Title: ${plan.title}
Conflict: ${plan.conflict}
Resolution: ${plan.resolution}
Characters: ${plan.characters.map((c) => `${c.name} (${c.role})`).join(', ')}

Output a JSON object matching this structure:
{
  "title": "${plan.title}",
  "pages": [
    { "pageNumber": 1, "text": "Page 1 content..." }
  ],
  "metadata": {
    "theme": "${context.theme}",
    "selGoal": "${context.selGoal}"
  }
}
    `.trim();

    return { systemPrompt, userPrompt };
  }
}
