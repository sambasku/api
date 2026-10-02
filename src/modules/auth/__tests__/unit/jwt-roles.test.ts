import { describe, expect, it, beforeAll } from 'vitest';
import { exportJWK, importJWK, SignJWT } from 'jose';
import { webcrypto } from 'node:crypto';
import { JwtTokenService } from '../../infrastructure/jwt-token.service';

// Keypair RSA dibangkitkan runtime (bukan fixture statis, bukan secret).
let svc: JwtTokenService;
let privateKey: webcrypto.CryptoKey;

beforeAll(async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  ) as unknown as webcrypto.CryptoKeyPair;
  privateKey = pair.privateKey;
  const spki = await webcrypto.subtle.exportKey('spki', pair.publicKey);
  const b64 = Buffer.from(spki).toString('base64');
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
  const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', pair.privateKey);
  const b64p = Buffer.from(pkcs8).toString('base64');
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${b64p}\n-----END PRIVATE KEY-----`;
  svc = new JwtTokenService({ privateKeyPem, publicKeyPem, accessTokenTtlSeconds: 900 });
});

describe('JwtTokenService klaim roles', () => {
  it('sign → verify: roles[] + role deprecated derived tertinggi', async () => {
    const token = await svc.generateAccessToken({ user_id: 'u1', roles: ['contributor', 'admin'], role: 'admin' });
    const payload = await svc.verifyAccessToken(token);
    expect(payload.user_id).toBe('u1');
    expect(payload.roles).toEqual(['contributor', 'admin']);
    expect(payload.role).toBe('admin');
  });

  it('token legacy tanpa roles → dinormalisasi roles=[role]', async () => {
    // Sign manual pakai jose dengan hanya claim `role` (bentuk token lama).
    const privJwk = await exportJWK(privateKey);
    const key = await importJWK(privJwk, 'RS256');
    const legacy = await new SignJWT({ role: 'reviewer' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('u2')
      .setIssuedAt()
      .setExpirationTime('900s')
      .sign(key);
    const payload = await svc.verifyAccessToken(legacy);
    expect(payload.roles).toEqual(['reviewer']);
    expect(payload.role).toBe('reviewer');
  });

  it('token tanpa role sama sekali → UNAUTHORIZED', async () => {
    const privJwk = await exportJWK(privateKey);
    const key = await importJWK(privJwk, 'RS256');
    const none = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('u3')
      .setIssuedAt()
      .setExpirationTime('900s')
      .sign(key);
    await expect(svc.verifyAccessToken(none)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' });
  });
});
