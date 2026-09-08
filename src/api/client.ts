import axios from 'axios';
import { errorMapper } from './errors';

const DEFAULT_API_BASE_URL = 'https://najmah-api.nextnext-gen.com/api/v2';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL;

// Axios instance with HttpOnly cookie support (withCredentials: true)
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // We can add tracking, CSRF headers, or logic here in the future
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
