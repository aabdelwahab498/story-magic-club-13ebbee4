export interface Story {
  id: string;
  childId: string;
  parentUserId: string;
  title?: string;
  theme?: string;
  selGoal?: string;
  language?: string;
  readingLevel?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
