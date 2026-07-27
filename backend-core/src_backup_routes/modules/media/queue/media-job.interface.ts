import { MediaType } from '../gateway/media.gateway.js';

export interface MediaTask {
  storyId: string;
  type: MediaType;
  metadata?: Record<string, any>;
  requestId: string;
}

export interface MediaJob {
  id: string;
  name: string;
  data: MediaTask;
  progress: number;
}
