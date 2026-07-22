import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, axiosInstance } from './client';
import { ApiError } from './errors';

describe('API Client & Interceptors', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axiosInstance);
  });

  afterEach(() => {
    mock.reset();
  });

  it('should successfully execute a basic GET request', async () => {
    const mockData = { test: 'value' };
    mock.onGet('/test-endpoint').reply(200, mockData);

    const response = await apiClient<typeof mockData>('/test-endpoint');
    expect(response).toEqual(mockData);
  });

  it('should map 401 errors using errorMapper', async () => {
    mock.onGet('/secure-endpoint').reply(401, { message: 'Raw backend error' });

    await expect(apiClient('/secure-endpoint')).rejects.toThrowError(ApiError);
    await expect(apiClient('/secure-endpoint')).rejects.toMatchObject({
      status: 401,
      message: 'Raw backend error' // The mapper prefers the backend's explicit message if provided
    });
  });

  it('should fallback to default Unauthorized message if 401 response has no message', async () => {
    mock.onGet('/secure-endpoint').reply(401);

    await expect(apiClient('/secure-endpoint')).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized. Please log in again.'
    });
  });

  it('should handle Network Errors (no response)', async () => {
    mock.onGet('/network-error').networkError();

    await expect(apiClient('/network-error')).rejects.toMatchObject({
      status: 500,
      message: 'Network error. Please check your connection.'
    });
  });

  it('should handle Timeout Errors', async () => {
    mock.onGet('/timeout').timeout();

    await expect(apiClient('/timeout')).rejects.toMatchObject({
      status: 500,
      message: 'Request timed out. Please try again.'
    });
  });
});
