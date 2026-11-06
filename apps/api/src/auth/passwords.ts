import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Algorithm is a const enum in @node-rs/argon2's types, which esbuild cannot inline; 2 = Argon2id.
const ARGON2ID = 2;

// OWASP-recommended argon2id parameters (19 MiB, 2 passes, 1 lane): fast enough for Render's free tier.
const options = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Built at module load so the first unknown-email login is not slower than later ones.
const dummyHash: Promise<string> = hashPassword(randomBytes(16).toString('hex'));

/**
 * Runs a full verify against a throwaway hash, so a login for an unknown email takes about as long
 * as a login with a wrong password and the two cannot be told apart by timing.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(await dummyHash, password);
}
