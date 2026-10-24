import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from './index.js';

describe('session tokens', () => {
  const userId = '7b0c8f8e-2a51-4c1e-9d0a-2f8a1f2b3c4d';

  it('verifies a token it signed', () => {
    expect(verifySession(signSession(userId, 's3cret'), 's3cret')).toBe(userId);
  });

  it('rejects a token signed with another secret, tampered with, or malformed', () => {
    const token = signSession(userId, 's3cret');
    expect(verifySession(token, 'other')).toBeUndefined();
    expect(verifySession(token.replace(userId, '00000000-0000-0000-0000-000000000000'), 's3cret')).toBeUndefined();
    expect(verifySession('nonsense', 's3cret')).toBeUndefined();
    expect(verifySession(undefined, 's3cret')).toBeUndefined();
  });
});
