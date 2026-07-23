import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, hashPassword, verifyPassword } from '../auth.js';

describe('auth utils', () => {
  describe('JWT', () => {
    const payload = { userId: 'test-id', email: 'test@test.com', role: 'admin' };

    it('signs and verifies a token', () => {
      const token = signToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('returns decoded payload on verify', () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded).toBeTruthy();
      expect(decoded!.userId).toBe('test-id');
      expect(decoded!.email).toBe('test@test.com');
    });

    it('returns null for invalid token', () => {
      const result = verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('returns null for tampered token', () => {
      const token = signToken(payload);
      const tampered = token.slice(0, -5) + 'xxxxx';
      const result = verifyToken(tampered);
      expect(result).toBeNull();
    });
  });

  describe('password hashing', () => {
    it('hashes and verifies a password', async () => {
      const hash = await hashPassword('my-password');
      expect(hash).toBeTruthy();
      expect(hash).not.toBe('my-password');
    });

    it('returns true for correct password', async () => {
      const hash = await hashPassword('my-password');
      const valid = await verifyPassword('my-password', hash);
      expect(valid).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const hash = await hashPassword('my-password');
      const valid = await verifyPassword('wrong-password', hash);
      expect(valid).toBe(false);
    });

    it('produces different hashes for same password (salt)', async () => {
      const hash1 = await hashPassword('same-pass');
      const hash2 = await hashPassword('same-pass');
      expect(hash1).not.toBe(hash2);
    });
  });
});
