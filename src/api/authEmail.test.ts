import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { authApi } from './auth.api';
import { axiosInstance } from './client';

describe('AUTH-EMAIL-003A — NestJS email confirmation API', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axiosInstance);
  });
  afterEach(() => {
    mock.reset();
    vi.restoreAllMocks();
  });

  it('uses the deployed API base URL with credentials enabled', () => {
    expect(axiosInstance.defaults.baseURL).toBe(
      'https://najmah-api.nextnext-gen.com/api/v2'
    );
    expect(axiosInstance.defaults.withCredentials).toBe(true);
  });

  it('register surfaces requiresConfirmation from the backend', async () => {
    mock.onPost('/auth/register').reply(201, { requiresConfirmation: true });
    const res = await authApi.register({ email: 'a@b.com', password: 'secret1' });
    expect(res.requiresConfirmation).toBe(true);
  });

  it('verify-email posts token_hash and type=signup', async () => {
    mock.onPost('/auth/verify-email').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({
        token_hash: 'abc123',
        type: 'signup',
      });
      return [200, { success: true }];
    });
    const res = await authApi.verifyEmail('abc123');
    expect(res.success).toBe(true);
  });

  it('verify-email failure rejects and never stores the token', async () => {
    mock.onPost('/auth/verify-email').reply(400, { message: 'expired' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(authApi.verifyEmail('expired-hash')).rejects.toBeTruthy();
    expect(JSON.stringify(localStorage)).not.toContain('expired-hash');
    expect(JSON.stringify(sessionStorage)).not.toContain('expired-hash');
    expect(
      logSpy.mock.calls.flat().join(' ')
    ).not.toContain('expired-hash');
  });

  it('resend-confirmation posts email to NestJS and returns the generic message', async () => {
    mock.onPost('/auth/resend-confirmation').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ email: 'a@b.com' });
      return [200, { message: 'If an account exists, an email was sent.' }];
    });
    const res = await authApi.resendConfirmation('a@b.com');
    expect(res.message).toBe('If an account exists, an email was sent.');
  });
});
