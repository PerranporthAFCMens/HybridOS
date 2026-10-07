import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/data/auth', () => ({
  getSession: () => Promise.resolve(null),
  onSessionChange: () => () => undefined,
  signOut: () => Promise.resolve(),
}));
vi.mock('../src/data/memberships', () => ({
  listActiveGyms: () => Promise.resolve([]),
  newestMembership: () => Promise.resolve(null),
}));

import { AuthProvider } from '../src/auth/AuthProvider';
import { App } from '../src/app/App';

describe('App', () => {
  it('shows loading, then sends a signed-out visitor to the legacy login', async () => {
    const replace = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, replace }, writable: true });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('../login.html'));
  });
});
