import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import type { Database } from '../db/client';
import { refreshTokens } from '../db/schema';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ISSUER = 'solace-api';
const AUDIENCE = 'solace-app';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Clock = () => Date;

export type TokenService = ReturnType<typeof createTokenService>;

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createTokenService({
  db,
  jwtSecret,
  clock,
}: {
  db: Database;
  jwtSecret: string;
  clock: Clock;
}) {
  const key = new TextEncoder().encode(jwtSecret);
  const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

  async function signAccessToken(userId: string): Promise<string> {
    const now = seconds(clock());
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
      .sign(key);
  }

  /** Returns the user id, or null for any invalid, tampered or expired token. */
  async function verifyAccessToken(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
        currentDate: clock(),
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      return typeof payload.sub === 'string' && UUID_RE.test(payload.sub) ? payload.sub : null;
    } catch {
      return null;
    }
  }

  type Executor = Pick<Database, 'insert'>;

  async function issueRefreshToken(
    userId: string,
    familyId: string = randomUUID(),
    executor: Executor = db,
  ) {
    const token = randomBytes(32).toString('base64url');
    await executor.insert(refreshTokens).values({
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(clock().getTime() + REFRESH_TOKEN_TTL_MS),
    });
    return token;
  }

  async function issuePair(userId: string, familyId?: string) {
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(userId),
      issueRefreshToken(userId, familyId),
    ]);
    return { accessToken, refreshToken };
  }

  async function revokeFamily(familyId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: clock() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Rotates a refresh token. Returns null when the token is unknown, expired or already used.
   * Presenting a token that was already rotated (or revoked) is treated as theft: the whole family is revoked.
   */
  async function rotate(token: string) {
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
      .limit(1);
    if (!row) return null;

    if (row.revokedAt) {
      await revokeFamily(row.familyId);
      return null;
    }
    if (row.expiresAt.getTime() <= clock().getTime()) return null;

    // Claim and replacement commit together. The claim holds the row lock until commit, so a
    // concurrent refresh with the same token blocks on it, then finds the token already revoked
    // and revokes the family, which by then includes the winner's new token.
    const refreshToken = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(refreshTokens)
        .set({ revokedAt: clock() })
        .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });
      if (claimed.length === 0) return null;
      return issueRefreshToken(row.userId, row.familyId, tx);
    });
    if (!refreshToken) {
      await revokeFamily(row.familyId);
      return null;
    }

    return { accessToken: await signAccessToken(row.userId), refreshToken };
  }

  /** Logout: revokes the session (the token's whole family). Unknown tokens are ignored. */
  async function revoke(token: string) {
    const [row] = await db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
      .limit(1);
    if (row) await revokeFamily(row.familyId);
  }

  return { signAccessToken, verifyAccessToken, issuePair, rotate, revoke };
}
