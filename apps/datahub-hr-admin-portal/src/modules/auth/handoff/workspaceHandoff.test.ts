import { describe, expect, it } from 'vitest';
import { encodeHandoff } from '@/test/handoffToken';
import { HandoffError, parseHandoffToken, readHandoffToken, WORKSPACE_HANDOFF_ISSUER } from './workspaceHandoff';

const NOW = Date.parse('2026-11-18T10:00:00Z');

const valid = (overrides: Record<string, unknown> = {}) => ({
  issuer: WORKSPACE_HANDOFF_ISSUER,
  email: 'hr.admin@demo.datahubhr.test',
  expiresAt: new Date(NOW + 120_000).toISOString(),
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
