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

    // Explicit test trigger to simulate unrelated story substitution
    if (prompt.userPrompt.includes('SIMULATE_UNRELATED_STORY')) {
      return Promise.resolve(
        JSON.stringify({
          title: "Leo's Big Backyard Safari",
          characters: [
            { name: 'Leo', role: 'hero', description: 'A lion' },
            { name: 'Pip', role: 'companion', description: 'A mouse' },
          ],
          conflict: 'Looking for a golden acorn',
          resolution: 'Found the acorn',
          selGoals: ['Sharing'],
          pageCount: 5,
        }),
      );
    }

    // Custom brief detection for Omar & lost star or generic custom briefs
    if (prompt.userPrompt.includes('Omar') || prompt.userPrompt.includes('star')) {
      return Promise.resolve(
        JSON.stringify({
          title: 'Omar and the Lost Star',
          characters: [
            { name: 'Omar', role: 'hero', description: 'A curious 7-year-old boy' },
            { name: 'Glowing Star', role: 'companion', description: 'A tiny lost star' },
          ],
          conflict: 'The tiny star fell from the sky into Omar\'s garden and cannot find its way back.',
          resolution: 'Omar uses courage and kindness to help the star return safely to the night sky.',
          selGoals: ['Courage', 'Kindness'],
          pageCount: 5,
        }),
      );
    }

    const childMatch = prompt.userPrompt.match(/Child Name:\s*([^\n]+)/i);
    const heroName = childMatch ? childMatch[1].trim() : 'Hero';

    const mockResponse = {
      title: `${heroName}'s Magical Discovery`,
      characters: [
        { name: heroName, role: 'hero', description: `A brave child named ${heroName}` },
        { name: 'Owl', role: 'mentor', description: 'A wise old owl' },
        { name: 'Pip', role: 'companion', description: 'A fast little mouse' },
      ],
      conflict: `Pip wants to play too, but ${heroName} says no.`,
      resolution: `${heroName} shares the toy and they have fun.`,
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

    if (prompt.userPrompt.includes('SIMULATE_UNRELATED_STORY')) {
      return Promise.resolve(
        JSON.stringify({
          title: "Leo's Big Backyard Safari",
          pages: [
            { pageNumber: 1, text: "Leo and Pip went on a safari in the backyard looking for the Golden Acorn." },
            { pageNumber: 2, text: "They found the Golden Acorn and celebrated together." }
          ],
          metadata: { theme: 'safari', selGoal: 'sharing' },
        }),
      );
    }

    if (prompt.userPrompt.includes('Omar') || prompt.userPrompt.includes('star')) {
      return Promise.resolve(
        JSON.stringify({
          title: 'Omar and the Lost Star',
          pages: [
            {
              pageNumber: 1,
              text: 'Omar, a curious 7-year-old boy, was walking in his garden when he noticed a tiny glowing star lying softly on a leaf.',
            },
            {
              pageNumber: 2,
              text: 'The glowing star whispered that it had lost its way home to the sky. Omar felt courage and kindness in his heart and promised to help.',
            },
            {
              pageNumber: 3,
              text: 'Omar built a gentle high climb using branches and guided the tiny glowing star upward with care.',
            },
            {
              pageNumber: 4,
              text: 'With one brave reach, Omar helped the star leap back up. The little star safely returned to the night sky, twinkling happily.',
            },
          ],
          metadata: { theme: 'space', selGoal: 'courage' },
        }),
      );
    }

    const childMatch = prompt.userPrompt.match(/Child Name:\s*([^\n]+)/i);
    const heroName = childMatch ? childMatch[1].trim() : 'Hero';

    const mockStory = {
      title: `${heroName}'s Magical Discovery`,
      pages: [
        { pageNumber: 1, text: `${heroName} went on a wonderful adventure today.` },
        { pageNumber: 2, text: `${heroName} learned a lesson about sharing and empathy.` },
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
