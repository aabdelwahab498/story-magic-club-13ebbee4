// src/modules/users/interfaces/user-profile.interface.ts
import type { Language } from '../enums/index.js';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  language: Language;
  createdAt: Date;
  updatedAt: Date;
}
