export interface CharacterAppearance {
  hair?: string;
  eyes?: string;
  face?: string;
  skin?: string;
  body?: string;
}

export interface VisualTraits {
  style?: string;
  proportions?: string;
  features?: string[];
}

export interface CharacterBible {
  id?: string;
  storyId: string;
  characterName: string;
  role?: string;
  description?: string;
  age?: string;
  gender?: string;
  personality?: string;
  appearance: CharacterAppearance;
  visualTraits: VisualTraits;
  colorPalette: Record<string, string>;
  clothing: Record<string, string>;
  expressions: Record<string, string>;
  referencePrompt?: string;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CharacterReference {
  name: string;
  role: string;
  appearance: CharacterAppearance;
}
