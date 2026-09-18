import axios from 'axios';
import { errorMapper } from './errors';

const DEFAULT_API_BASE_URL = 'https://najmah-api.nextnext-gen.com/api/v2';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL;

// Axios instance with HttpOnly cookie support (withCredentials: true)
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // 90s: story plan/creation are long AI calls and the backend runs its own
  // bounded retry policy. A short client timeout would abort healthy work and
  // surface it as a connectivity failure.
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor — attaches the canonical Supabase access token so every
// authenticated Backend Core (/api/v2) call carries `Authorization: Bearer <token>`.
// Supabase Auth stays the single browser authentication authority; callers that
// already set an Authorization header (e.g. stories.api.ts) are left untouched.
axiosInstance.interceptors.request.use(
  async (config) => {
    const headers = config.headers as Record<string, unknown> | undefined;
    if (headers && !headers.Authorization && !headers.authorization) {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      return errorMapper(error);
    }
    return Promise.reject(error);
  }
);

/**
 * Base fetch client wrapper to maintain compatibility with existing
 * apiClient interface, but backed by Axios.
 */
export const apiClient = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await axiosInstance({
    url: endpoint,
    method: options.method || 'GET',
    // If body is passed as string (fetch style), we use it directly as data.
    // Axios will automatically send the string payload or JSON depending on type.
    data: options.body,
    headers: options.headers as Record<string, string>,
  });
  
  return response.data;
};
