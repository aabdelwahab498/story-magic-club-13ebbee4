export interface StoryContract {
  hasCustomPrompt: boolean;
  rawPrompt?: string;
  protagonistName?: string;
  protagonistAge?: number;
  keyCharacters: string[];
  keyObjects: string[];
  setting?: string;
  centralPremise?: string;
  endingRequirement?: string;
  requestedValues: string[];
  hardConstraints: string[];
  softConstraints: string[];
}
