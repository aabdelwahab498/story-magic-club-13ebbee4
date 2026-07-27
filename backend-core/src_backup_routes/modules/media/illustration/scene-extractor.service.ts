import { Injectable } from '@nestjs/common';
import { Scene } from './types/illustration.types.js';

@Injectable()
export class SceneExtractorService {
  /**
   * Deterministically extracts scenes from the raw story pages.
   * Future implementation: Use an LLM to enrich the scene descriptions if needed.
   * For now, it deterministically parses the text.
   *
   * @param pages The JSON array of story pages
   * @returns An array of Scenes mapped to their respective page numbers
   */
  extractScenes(pages: any[]): Scene[] {
    if (!pages || !Array.isArray(pages)) {
      return [];
    }

    return pages.map((page, index) => {
      // Basic deterministic extraction.
      // In a real scenario, this might use NLP or assume a specific JSON structure from the StoryWriter.
      // Assuming page has a `text` field based on standard AI story output.
      const text =
        typeof page === 'string' ? page : page.text || JSON.stringify(page);

      // Attempt to extract emotions or environments via simple heuristics or default them
      const emotion = this.inferEmotion(text);
      const environment = this.inferEnvironment(text);

      return {
        pageNumber: index + 1,
        sceneDescription: text.substring(0, 500), // Ensure it fits in prompt limits
        characters: ['Main Character'], // Default for MVP deterministic extraction
        environment,
        emotion,
      };
    });
  }

  private inferEmotion(text: string): string {
    const lower = text.toLowerCase();
    if (
      lower.includes('happy') ||
      lower.includes('smile') ||
      lower.includes('joy')
    )
      return 'Joyful and uplifting';
    if (
      lower.includes('sad') ||
      lower.includes('cry') ||
      lower.includes('tears')
    )
      return 'Melancholy but hopeful';
    if (
      lower.includes('scared') ||
      lower.includes('dark') ||
      lower.includes('fear')
    )
      return 'Mysterious and slightly tense';
    return 'Calm and engaging';
  }

  private inferEnvironment(text: string): string {
    const lower = text.toLowerCase();
    if (
      lower.includes('forest') ||
      lower.includes('tree') ||
      lower.includes('woods')
    )
      return 'A lush, magical forest';
    if (
      lower.includes('space') ||
      lower.includes('star') ||
      lower.includes('planet')
    )
      return 'Outer space with glowing stars';
    if (
      lower.includes('ocean') ||
      lower.includes('sea') ||
      lower.includes('water')
    )
      return 'Underwater kingdom';
    return 'A cozy, imaginative environment';
  }
}
