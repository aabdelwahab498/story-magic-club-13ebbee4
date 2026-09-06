import { apiClient } from './client';
import type { UserContext } from './types';
import type { AppRole, PermissionKey } from '@/lib/rbac';

export interface MeResponse extends UserContext {}

/**
 * Canonical identity/RBAC contract returned by `GET /api/v2/me`.
 * `roles[]` is canonical; `role` is kept for backward compatibility.
 */
export interface IdentityContextResponse {
  id: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
  permissions: PermissionKey[];
}

export const authApi = {
  /**
   * Register a new user
   */
  register: (data: any) => {
    return apiClient<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Log in via NestJS API (which sets the HttpOnly cookie)
   */
  login: (data: any) => {
    return apiClient<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Fetch current user's identity, primary role, assigned roles, and permissions from backend.
   */
  getMe: () => {
    return apiClient<MeResponse>('/auth/me');
  },

  /**
   * Canonical RBAC resolution: `GET /api/v2/me` authenticated with the current
   * Supabase access token. Supabase remains the session authority; the backend
   * is the authority for roles/permissions.
   */
  getIdentityContext: (accessToken: string) => {
    return apiClient<IdentityContextResponse>('/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  /**
   * Log out (clears the HttpOnly cookie on backend)
   */
  signOut: async () => {
    return apiClient<any>('/auth/logout', {
      method: 'POST',
    });
  },
};
