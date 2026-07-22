import { apiClient } from './client';
import type { UserContext } from './types';

export interface MeResponse extends UserContext {}

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
   * Log out (clears the HttpOnly cookie on backend)
   */
  signOut: async () => {
    return apiClient<any>('/auth/logout', {
      method: 'POST',
    });
  },
};
