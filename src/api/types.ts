export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
}

// Re-export common backend DTOs here to avoid duplication
// Note: We redefine the shapes that match the backend contracts identically

import type { AppRole, PermissionKey } from '@/lib/rbac';

export interface UserContext {
  id: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
  permissions: PermissionKey[];
  isAuthenticated: boolean;
}

export type StoryStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';

export interface UpdateStoryStatusDto {
  status: StoryStatus;
}
