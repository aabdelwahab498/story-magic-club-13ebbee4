export interface StoryRequest {
  id: string;
  childId: string;
  requestedBy: string;
  contextSnapshot: Record<string, any>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
