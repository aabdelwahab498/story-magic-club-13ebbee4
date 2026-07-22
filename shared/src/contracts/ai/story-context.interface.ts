export interface StoryContext {
  targetAge: number;
  language: string;
  readingLevel: string;
  theme: string;
  selGoal: string;
  pageCount?: number;
}

export interface PageContent {
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
  audioReference?: string;
}

export interface QualityScore {
  score: number;
  passed: boolean;
  feedback: string;
}
