export interface Character {
  name: string;
  role: string;
  description: string;
}

export interface StoryPlan {
  title: string;
  characters: Character[];
  conflict: string;
  resolution: string;
  selGoals: string[];
  pageCount: number;
}
