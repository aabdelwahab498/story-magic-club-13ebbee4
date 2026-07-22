import { CharacterReference } from '../../character/character.types.js';

export interface Scene {
  pageNumber: number;
  sceneDescription: string;
  characters: string[];
  environment: string;
  emotion: string;
}

export interface StructuredPrompt {
  style: string;
  characters: string;
  environment: string;
  lighting: string;
  emotion: string;
  camera: string;
}

export interface IllustrationMetadata {
  pageNumber?: number;
  scene?: Scene;
  prompt?: StructuredPrompt;
  characterReferences?: CharacterReference[];
}
