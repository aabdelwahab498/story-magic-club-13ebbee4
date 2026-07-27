import { Injectable } from '@nestjs/common';
import { Scene, StructuredPrompt } from './types/illustration.types.js';
import { CharacterBible } from '../character/character.types.js';

@Injectable()
export class IllustrationPromptBuilder {
  /**
   * Translates an extracted Scene into a highly structured prompt optimized
   * for image generation APIs (like Imagen or DALL-E).
   * Ensures child-friendly styling and consistency.
   */
  buildPrompt(
    scene: Scene,
    characters: CharacterBible[] = [],
  ): StructuredPrompt {
    // Enhance characters with Bible descriptions if available
    let charactersDesc = scene.characters.join(', ');
    if (characters.length > 0) {
      charactersDesc = characters
        .map(
          (c) =>
            `${c.characterName}, a ${c.role} with ${c.appearance.hair} hair, ${c.appearance.eyes || 'bright'} eyes, ${c.visualTraits.proportions || 'child friendly'} proportions`,
        )
        .join('; ');
    }

    return {
      style:
        'High quality 3D Pixar animation style, vibrant colors, soft lighting, child-friendly, magical and whimsical',
      characters: charactersDesc,
      environment: scene.environment,
      lighting: 'Soft cinematic lighting, warm ambient glow',
      emotion: scene.emotion,
      camera: 'Wide shot, clear subject framing',
    };
  }

  /**
   * Compiles the structured prompt into a single string if the provider requires plain text.
   */
  compileToString(prompt: StructuredPrompt): string {
    return `Style: ${prompt.style}. Characters: ${prompt.characters}. Setting: ${prompt.environment}. Lighting: ${prompt.lighting}. Mood: ${prompt.emotion}. Camera: ${prompt.camera}.`;
  }
}
