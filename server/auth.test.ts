import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
});

describe('password hashing', () => {
  it('produces a hash different from the plaintext password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('mySecurePassword123');
    const result = await verifyPassword('mySecurePassword123', hash);
    expect(result).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('mySecurePassword123');
    const result = await verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });
});

describe('JWT tokens', () => {
  it('signs and verifies a valid token round-trip', () => {
    const token = signToken({ userId: 1, email: 'test@example.com' });
    const payload = verifyToken(token);
    expect(payload?.userId).toBe(1);
    expect(payload?.email).toBe('test@example.com');
  });

  it('rejects a tampered token', () => {
    const token = signToken({ userId: 1, email: 'test@example.com' });
    const tampered = token.slice(0, -2) + 'xx';
    const payload = verifyToken(tampered);
    expect(payload).toBeNull();
  });

  it('throws when JWT_SECRET is missing', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => signToken({ userId: 1, email: 'a@b.com' })).toThrow();
    process.env.JWT_SECRET = original;
  });
});
