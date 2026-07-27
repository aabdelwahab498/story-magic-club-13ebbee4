import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider } from '../interfaces/llm-provider.interface.js';
import { QualityScore } from '../interfaces/story-types.js';
import { GeneratedPrompt } from '../prompts/generated-prompt.interface.js';

@Injectable()
export class MockLLMProvider implements LLMProvider {
  private readonly logger = new Logger(MockLLMProvider.name);

  generateBlueprint(prompt: GeneratedPrompt): Promise<string> {
    this.logger.debug(
      `Generating mock blueprint from prompt of length: ${prompt.userPrompt.length}`,
    );

    // Simulate invalid prompt triggering a failure
    if (prompt.userPrompt.includes('FAIL_PROVIDER')) {
      return Promise.reject(new Error('Simulated provider failure'));
    }

    // Simulate returning malformed JSON
    if (prompt.userPrompt.includes('FAIL_JSON')) {
      return Promise.resolve('{ invalid_json: ');
    }

    // Simulate returning missing fields
    if (prompt.userPrompt.includes('FAIL_VALIDATION')) {
      return Promise.resolve(JSON.stringify({ title: 'Missing characters' }));
    }

    const mockResponse = {
      title: 'The Brave Little Lion',
      characters: [
        { name: 'Leo', role: 'hero', description: 'A brave little lion' },
        { name: 'Owl', role: 'mentor', description: 'A wise old owl' },
        { name: 'Pip', role: 'companion', description: 'A fast little mouse' },
      ],
      conflict: 'Pip wants to play too, but Leo says no.',
      resolution: 'Leo shares the toy and they have fun.',
      selGoals: ['Sharing'],
      pageCount: 5,
    };

    return Promise.resolve(JSON.stringify(mockResponse));
  }

  generateStory(prompt: GeneratedPrompt): Promise<string> {
    this.logger.debug(
      `Generating mock story from prompt of length: ${prompt.userPrompt.length}`,
    );

    if (prompt.userPrompt.includes('FAIL_PROVIDER')) {
      return Promise.reject(new Error('Simulated provider failure'));
    }

    if (prompt.userPrompt.includes('FAIL_JSON')) {
      return Promise.resolve('{ invalid_json: ');
    }

    if (prompt.userPrompt.includes('FAIL_VALIDATION_MISSING_PAGES')) {
      return Promise.resolve(JSON.stringify({ title: 'Missing pages array' }));
    }

    if (prompt.userPrompt.includes('FAIL_VALIDATION_EMPTY_PAGES')) {
      return Promise.resolve(JSON.stringify({ title: 'Title', pages: [] }));
    }

    const mockStory = {
      title: 'Mock Generated Story',
      pages: [
        { pageNumber: 1, text: 'This is the first page of the story.' },
        { pageNumber: 2, text: 'This is the second page of the story.' },
      ],
      metadata: { theme: 'space', selGoal: 'sharing' },
    };

    return Promise.resolve(JSON.stringify(mockStory));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  evaluateQuality(story: string): Promise<QualityScore> {
    this.logger.debug(`Evaluating story quality`);
    return Promise.resolve({
      score: 22,
      passed: true,
      feedback: 'Excellent story pacing and age-appropriate vocabulary.',
    });
  }
}
