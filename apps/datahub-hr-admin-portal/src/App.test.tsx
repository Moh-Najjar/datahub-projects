import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App (smoke test)', () => {
  it('boots with the real browser router and sends signed-out users to sign-in', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });
});
