/**
 * B-01 unit tests for auth utilities.
 * Prisma is fully mocked — no database required.
 */

// ─── Mock prisma before any imports that reference it ────────────────────────

const mockRefreshToken = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock('../../db/prisma', () => ({
  prisma: { refreshToken: mockRefreshToken },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  rotateRefreshToken,
} from './auth.service';

// ─── hashPassword / verifyPassword ────────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('produces a hash and verifies correctly', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword(hash, 'correct-horse-battery')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('produces different hashes for the same password (salted)', async () => {
    const h1 = await hashPassword('samepassword');
    const h2 = await hashPassword('samepassword');
    expect(h1).not.toBe(h2);
  });
});

// ─── signAccessToken / verifyAccessToken ─────────────────────────────────────

describe('signAccessToken / verifyAccessToken', () => {
  const payload = {
    sub: 'user-uuid-1',
    role: 'ADMIN',
    permissions: ['product:read', 'sale:create'],
  };

  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.permissions).toEqual(payload.permissions);
  });

  it('throws on a tampered token', () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('throws on a completely invalid string', () => {
    expect(() => verifyAccessToken('not.a.token')).toThrow();
  });
});

// ─── signRefreshToken ─────────────────────────────────────────────────────────

describe('signRefreshToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a DB record and returns a non-empty token', async () => {
    mockRefreshToken.create.mockResolvedValue({});

    const { token, tokenId } = await signRefreshToken('user-uuid-1');

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    expect(typeof tokenId).toBe('string');
    expect(tokenId.length).toBeGreaterThan(0);
    expect(mockRefreshToken.create).toHaveBeenCalledTimes(1);

    const callArg = mockRefreshToken.create.mock.calls[0][0];
    expect(callArg.data.userId).toBe('user-uuid-1');
    expect(callArg.data.id).toBe(tokenId);
    expect(typeof callArg.data.tokenHash).toBe('string');
    expect(callArg.data.expiresAt).toBeInstanceOf(Date);
  });
});

// ─── rotateRefreshToken ───────────────────────────────────────────────────────

describe('rotateRefreshToken', () => {
  beforeEach(() => jest.clearAllMocks());

  async function issueToken(userId = 'user-uuid-1') {
    mockRefreshToken.create.mockResolvedValue({});
    return signRefreshToken(userId);
  }

  it('revokes old token and returns a new one', async () => {
    const { token, tokenId } = await issueToken();

    mockRefreshToken.findUnique.mockResolvedValue({
      id: tokenId,
      userId: 'user-uuid-1',
      tokenHash: 'stored-hash',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });
    mockRefreshToken.update.mockResolvedValue({});
    mockRefreshToken.create.mockResolvedValue({});

    const result = await rotateRefreshToken(token);

    expect(result.userId).toBe('user-uuid-1');
    expect(typeof result.token).toBe('string');
    expect(result.token).not.toBe(token);

    // Old token must be revoked
    expect(mockRefreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: tokenId }, data: { revokedAt: expect.any(Date) } }),
    );
  });

  it('detects reuse of a revoked token and revokes all family tokens', async () => {
    const { token, tokenId } = await issueToken();

    mockRefreshToken.findUnique.mockResolvedValue({
      id: tokenId,
      userId: 'user-uuid-1',
      tokenHash: 'stored-hash',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: new Date(), // already revoked → reuse
    });
    mockRefreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(rotateRefreshToken(token)).rejects.toThrow();

    // All active tokens for the user must be revoked
    expect(mockRefreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-uuid-1', revokedAt: null }),
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('throws on a structurally invalid token string', async () => {
    await expect(rotateRefreshToken('not.a.valid.jwt')).rejects.toThrow();
  });

  it('throws when the token record does not exist in DB', async () => {
    const { token } = await issueToken();
    mockRefreshToken.findUnique.mockResolvedValue(null);
    await expect(rotateRefreshToken(token)).rejects.toThrow();
  });
});
