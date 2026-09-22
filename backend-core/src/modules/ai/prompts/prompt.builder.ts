import { Injectable } from '@nestjs/common';
import { StoryContext } from '../context/story-context.interface.js';
import { GeneratedPrompt } from './generated-prompt.interface.js';
import { StoryPlan } from '../interfaces/story-plan.interface.js';

@Injectable()
export class PromptBuilder {
  buildPlannerPrompt(context: StoryContext): GeneratedPrompt {
    const systemPrompt = `You are Najmah, an expert children's story planner. Your job is to create a structured story plan that adheres to the Najmah AI Story Constitution. Do not generate the story text itself, only the blueprint.`;

    const userPrompt = `
Create a story plan for a ${context.targetAge}-year-old child.
Language: ${context.language}
Reading Level: ${context.readingLevel}
Theme: ${context.theme}
SEL Goal: ${context.selGoal}
${
  context.customPrompt
    ? `USER STORY BRIEF (primary narrative requirement):\n"""${context.customPrompt}"""\nThe title, protagonist, conflict, events, and ending MUST follow this brief. Never replace a protagonist explicitly named in the brief with the child profile name or another character.`
    : ''
}

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

  buildWriterPrompt(context: StoryContext, plan: StoryPlan): GeneratedPrompt {
    const systemPrompt = `You are Najmah, an expert children's story writer. Write the story content based on the provided blueprint. Ensure the text is engaging and strictly adheres to the given reading level and SEL goal.`;

    const userPrompt = `
Write a ${plan.pageCount}-page story.
Target Age: ${context.targetAge}
Reading Level: ${context.readingLevel}
Language: ${context.language}
SEL Goal: ${context.selGoal}
${
  context.customPrompt
    ? `USER STORY BRIEF (primary narrative requirement):\n"""${context.customPrompt}"""\nThe complete story MUST stay faithful to this brief from beginning to end. A protagonist explicitly named in the brief must remain the protagonist on every page and in the ending.`
    : ''
}

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
