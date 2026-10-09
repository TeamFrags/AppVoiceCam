import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const AUDIENCE = 'api';

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

export interface TokenService {
  signAccess(claims: AccessClaims): Promise<string>;
  /** Throws if the signature, issuer, audience or expiry is invalid. */
  verifyAccess(token: string): Promise<AccessClaims>;
}

export function createTokenService(opts: {
  privateKeyPem?: string;
  issuer: string;
  ttlSec: number;
}): TokenService {
  // Without a configured key (development/tests) an ephemeral one is used: tokens die with the process.
  const privateKey: KeyObject = opts.privateKeyPem
    ? createPrivateKey(opts.privateKeyPem.replace(/\\n/g, '\n'))
    : generateKeyPairSync('ed25519').privateKey;
  const publicKey = createPublicKey(privateKey);

  return {
    signAccess({ userId, sessionId }) {
      return new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'at+jwt' })
        .setSubject(userId)
        .setIssuer(opts.issuer)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${opts.ttlSec}s`)
        .sign(privateKey);
    },
    async verifyAccess(token) {
      const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ['EdDSA'],
        issuer: opts.issuer,
        audience: AUDIENCE,
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('malformed access token');
      }
      return { userId: payload.sub, sessionId: payload.sid };
    },
  };
}

/** Random opaque token (refresh tokens, email links). Only its hash is ever stored. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
