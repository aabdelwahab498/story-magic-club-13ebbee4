import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './AuthCallback';

const verifyEmail = vi.fn();
vi.mock('@/api/auth.api', () => ({
  authApi: { verifyEmail: (h: string) => verifyEmail(h) },
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ refreshAdmin: vi.fn() }),
}));

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </MemoryRouter>
  );

describe('AUTH-EMAIL-003A — /auth/callback', () => {
  beforeEach(() => {
    verifyEmail.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('verifies a valid signup token_hash', async () => {
    verifyEmail.mockResolvedValue({ success: true });
    renderAt('?token_hash=tok_valid&type=signup');
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith('tok_valid'));
    expect(await screen.findByText(/Email confirmed/i)).toBeTruthy();
  });

  it('rejects a missing token_hash without calling the backend', async () => {
    renderAt('?type=signup');
    expect(await screen.findByTestId('callback-error')).toBeTruthy();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('rejects an invalid type without calling the backend', async () => {
    renderAt('?token_hash=tok_valid&type=magiclink');
    expect(await screen.findByTestId('callback-error')).toBeTruthy();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('shows a safe error on verification failure and never stores the token', async () => {
    verifyEmail.mockRejectedValue(new Error('supabase: token expired raw detail'));
    renderAt('?token_hash=tok_expired&type=signup');
    const err = await screen.findByTestId('callback-error');
    expect(err.textContent).not.toContain('supabase');
    expect(err.textContent).not.toContain('tok_expired');
    expect(JSON.stringify(localStorage)).not.toContain('tok_expired');
    expect(JSON.stringify(sessionStorage)).not.toContain('tok_expired');
  });
});
