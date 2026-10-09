import { hash, verify } from '@node-rs/argon2';

// Argon2id (library default) with OWASP's recommended minimum parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies a password. When the account does not exist, a dummy hash is checked instead so
 * that response time does not reveal whether an email is registered.
 */
export async function verifyPassword(
  storedHash: string | undefined,
  password: string,
): Promise<boolean> {
  if (!storedHash) {
    dummyHash ??= hashPassword('dummy-password-for-unknown-accounts');
    await verify(await dummyHash, password);
    return false;
  }
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
