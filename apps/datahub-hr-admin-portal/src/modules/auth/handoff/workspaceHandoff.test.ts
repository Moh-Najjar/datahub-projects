import { describe, expect, it } from 'vitest';
import { accessToken, encodeHandoff } from '@/test/handoffToken';
import { HandoffError, parseHandoffToken, readAccessToken, readHandoffToken, WORKSPACE_HANDOFF_ISSUER } from './workspaceHandoff';

const NOW = Date.parse('2026-11-18T10:00:00Z');

const valid = (overrides: Record<string, unknown> = {}) => ({
  issuer: WORKSPACE_HANDOFF_ISSUER,
  email: 'hr.admin@demo.datahubhr.test',
  expiresAt: new Date(NOW + 120_000).toISOString(),
  accessToken: 'header.payload.signature',
  ...overrides,
});

const reason = (token: string | null) => {
  try {
    parseHandoffToken(token, NOW);
    return 'accepted';
  } catch (error) {
    return error instanceof HandoffError ? error.reason : 'other';
  }
};

describe('Workspace handoff token', () => {
  it('reads the token from the hash only', () => {
    expect(readHandoffToken('#token=abc')).toBe('abc');
    expect(readHandoffToken('#other=1&token=abc')).toBe('abc');
    expect(readHandoffToken('')).toBeNull();
    expect(readHandoffToken('#token=')).toBeNull();
  });

  it('accepts a valid token', () => {
    expect(parseHandoffToken(encodeHandoff(valid()), NOW)).toEqual(valid());
  });

  it('rejects a missing token', () => {
    expect(reason(null)).toBe('missing');
  });

  it.each([
    ['not base64url', '***'],
    ['not JSON', 'eyJub3QganNvbg'],
    ['wrong issuer', encodeHandoff(valid({ issuer: 'someone-else' }))],
    ['no email', encodeHandoff(valid({ email: undefined }))],
    ['bad date', encodeHandoff(valid({ expiresAt: 'tomorrow' }))],
    ['array payload', encodeHandoff([1, 2])],
  ])('rejects a malformed token (%s)', (_, token) => {
    expect(reason(token)).toBe('malformed');
  });

  it('rejects an expired token and one that claims a long life', () => {
    expect(reason(encodeHandoff(valid({ expiresAt: new Date(NOW - 1).toISOString() })))).toBe('expired');
    expect(reason(encodeHandoff(valid({ expiresAt: new Date(NOW + 60 * 60_000).toISOString() })))).toBe('expired');
  });
});

describe('access token (JWT) claims', () => {
  const exp = NOW / 1000 + 900;
  it('reads user, roles, permissions and expiry — one value as a string, several as an array', () => {
    const token = accessToken({ sub: 'u-1', email: 'admin@datahub.test', display_name: 'Platform Admin', role: 'system-admin', permission: ['hr.leave.view', 'cms.blogs.view'], exp });
    expect(readAccessToken(token, NOW)).toEqual({ userId: 'u-1', email: 'admin@datahub.test', displayName: 'Platform Admin', roles: ['system-admin'], permissions: ['hr.leave.view', 'cms.blogs.view'], expiresAt: exp * 1000 });
    expect(readAccessToken(accessToken({ email: 'a@datahub.test', role: ['a', 'b'], permission: 'hr.leave.view', exp }), NOW)).toMatchObject({ roles: ['a', 'b'], permissions: ['hr.leave.view'], displayName: 'a@datahub.test' });
  });

  it('rejects what is not a JWT, and an expired token', () => {
    const failure = (token: string) => {
      try {
        readAccessToken(token, NOW);
        return 'accepted';
      } catch (error) {
        return error instanceof HandoffError ? error.reason : 'other';
      }
    };
    expect(failure('not-a-jwt')).toBe('malformed');
    expect(failure(accessToken({ email: 'a@datahub.test', exp: NOW / 1000 - 1 }))).toBe('expired');
  });

  it('a handoff without an access token is malformed', () => {
    expect(reason(encodeHandoff(valid({ accessToken: undefined })))).toBe('malformed');
  });
});
