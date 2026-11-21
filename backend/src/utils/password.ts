import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

/**
 * Password format: `scrypt$N$r$p$<salt-base64>$<hash-base64>`.
 *
 * The parameters are stored so a future parameter change can be identified, but verification
 * only accepts the current parameter set. That avoids letting a tampered or corrupt stored
 * hash request unbounded scrypt memory.
 */
const SCRYPT_SCHEME = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PART_COUNT = 6;

const SCRYPT_OPTIONS: ScryptOptions = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: 64 * 1024 * 1024,
};

function deriveKey(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH);

  return [
    SCRYPT_SCHEME,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64'),
    derivedKey.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');

  if (parts.length !== PART_COUNT) {
    return false;
  }

  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;

  if (
    scheme !== SCRYPT_SCHEME ||
    nRaw !== String(SCRYPT_N) ||
    rRaw !== String(SCRYPT_R) ||
    pRaw !== String(SCRYPT_P)
  ) {
    return false;
  }

  const salt = Buffer.from(saltRaw ?? '', 'base64');
  const expectedKey = Buffer.from(hashRaw ?? '', 'base64');

  if (salt.length !== SALT_LENGTH || expectedKey.length !== KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveKey(password, salt, KEY_LENGTH);

  return timingSafeEqual(expectedKey, actualKey);
}
