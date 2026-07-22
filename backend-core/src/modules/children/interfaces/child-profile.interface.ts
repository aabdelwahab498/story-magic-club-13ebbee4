// src/modules/users/interfaces/child-profile.interface.ts
import type { ReadingLevel } from '../enums/index.js';
import type { Language } from '../../users/enums/index.js';

export interface ChildProfile {
  id: string;
  userId: string;
  name: string;
  age: number;
  language: Language;
  interests: string[];
  emotionalGoals: string[];
  readingLevel: ReadingLevel;
  createdAt: Date;
  updatedAt: Date;
}
