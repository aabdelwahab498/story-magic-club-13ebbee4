export interface TrialStoryPageDto {
  index: number;
  text: string;
  emotionTag: string;
  illustrationPrompt: string;
  imageUrl: string | null;
}

export interface TrialStoryResponseDto {
  requestId: string;
  teaser: true;
  title: string;
  pages: TrialStoryPageDto[];
  totalPages: number;
  shownPages: number;
  sel_outcome?: {
    skill: string;
    emotion: string;
    statement: string;
  };
  fallbackUsed?: boolean;
}
