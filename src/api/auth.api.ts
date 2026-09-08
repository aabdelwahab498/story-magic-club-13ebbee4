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

export interface RegisterResponse {
  requiresConfirmation?: boolean;
  [key: string]: unknown;
}

export interface VerifyEmailResponse {
  success?: boolean;
  [key: string]: unknown;
}

export const authApi = {
  /**
   * Register a new user
   */
  register: (data: any) => {
    return apiClient<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Confirm a signup email using the token_hash from the emailed link.
   * The backend sets the HttpOnly session cookie (withCredentials is enabled).
   */
  verifyEmail: (tokenHash: string) => {
    return apiClient<VerifyEmailResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token_hash: tokenHash, type: 'signup' }),
    });
  },

  /**
   * Request another confirmation email. The backend always returns a generic
   * message so account existence is never disclosed.
   */
  resendConfirmation: (email: string) => {
    return apiClient<{ message?: string }>('/auth/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify({ email }),
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
