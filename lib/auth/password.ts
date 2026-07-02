import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Node's built-in `crypto.scrypt` instead of bcrypt/argon2 — no native
// module, so no Windows build-tooling dependency (see PRD_step3 tech notes).

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Returns "<saltHex>:<hashHex>", safe to store as-is in the users table. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}
