import { QualityScore } from './story-types.js';
import { GeneratedPrompt } from '../prompts/generated-prompt.interface.js';

export const LLM_PROVIDER = 'LLM_PROVIDER';

export interface LLMProvider {
  generateBlueprint(prompt: GeneratedPrompt): Promise<string>;
  generateStory(prompt: GeneratedPrompt): Promise<string>;
  evaluateQuality(story: string): Promise<QualityScore>;
}
