import { describe, expect, it } from 'vitest';
import { testAccessToken, testHandoffToken } from '@/test/handoffToken';
import { HandoffError, parseHandoffToken, readAccessToken, readHandoffToken } from './workspaceHandoff';

const NOW = Date.UTC(2026, 10, 23, 9, 0, 0);

const rejects = (fn: () => unknown, reason: HandoffError['reason']) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HandoffError);
    expect((error as HandoffError).reason).toBe(reason);
    return;
  }
  throw new Error('expected a HandoffError');
};

describe('readHandoffToken', () => {
  it('reads the token from the URL hash and ignores everything else', () => {
    expect(readHandoffToken('#token=abc123')).toBe('abc123');
    expect(readHandoffToken('token=abc123')).toBe('abc123');
    expect(readHandoffToken('')).toBeNull();
    expect(readHandoffToken('#other=1')).toBeNull();
  });
});

describe('parseHandoffToken', () => {
  it('accepts a valid handoff', () => {
    const token = testHandoffToken({ now: NOW, claims: { email: 'sara@example.test' } });
    const payload = parseHandoffToken(token, NOW);
    expect(payload.email).toBe('sara@example.test');
    expect(payload.issuer).toBe('datahub-workspace-prototype');
    expect(payload.accessToken.split('.')).toHaveLength(3);
  });

  it('rejects a missing token', () => {
    rejects(() => parseHandoffToken(null, NOW), 'missing');
  });

  it('rejects malformed tokens: bad characters, not JSON, wrong shape', () => {
    rejects(() => parseHandoffToken('not base64 !!', NOW), 'malformed');
    rejects(() => parseHandoffToken('YWJj', NOW), 'malformed'); // "abc" — not JSON
    rejects(() => parseHandoffToken(btoa('[]').replace(/=+$/, ''), NOW), 'malformed');
    rejects(() => parseHandoffToken(btoa('{"issuer":"someone-else"}').replace(/=+$/, ''), NOW), 'malformed');
  });

  it('rejects a handoff from an unknown issuer', () => {
    rejects(() => parseHandoffToken(testHandoffToken({ now: NOW, issuer: 'evil-workspace' }), NOW), 'malformed');
  });

  it('rejects an expired handoff link', () => {
    const token = testHandoffToken({ now: NOW - 10 * 60_000 });
    rejects(() => parseHandoffToken(token, NOW), 'expired');
  });

  it('rejects a link that claims a longer life than the Workspace issues', () => {
    rejects(() => parseHandoffToken(testHandoffToken({ now: NOW, lifetimeMs: 60 * 60_000 }), NOW), 'expired');
  });
});

describe('readAccessToken', () => {
  it('reads the user, roles, permissions and expiry from the JWT claims', () => {
    const jwt = testAccessToken({ sub: 'u-1', email: 'a@b.test', display_name: 'Ada Lovelace', role: ['system-admin', 'employee'], permission: 'hr.dashboard.view', exp: Math.floor(NOW / 1000) + 600 }, NOW);
    expect(readAccessToken(jwt, NOW)).toEqual({ userId: 'u-1', email: 'a@b.test', displayName: 'Ada Lovelace', roles: ['system-admin', 'employee'], permissions: ['hr.dashboard.view'], expiresAt: (Math.floor(NOW / 1000) + 600) * 1000 });
  });

  it('falls back to the e-mail as the display name', () => {
    const jwt = testAccessToken({ display_name: '' }, NOW);
    expect(readAccessToken(jwt, NOW).displayName).toBe('workspace.user@example.test');
  });

  it('rejects an expired access token and anything that is not a JWT', () => {
    rejects(() => readAccessToken(testAccessToken({ exp: Math.floor(NOW / 1000) - 5 }, NOW), NOW), 'expired');
    rejects(() => readAccessToken('plainly-not-a-jwt', NOW), 'malformed');
    rejects(() => readAccessToken(`x.${btoa('{"sub":1}').replace(/=+$/, '')}.y`, NOW), 'malformed');
  });
});
