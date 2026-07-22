export interface StoryPage {
  pageNumber: number;
  text: string;
}

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
  metadata: {
    theme: string;
    selGoal: string;
  };
}
