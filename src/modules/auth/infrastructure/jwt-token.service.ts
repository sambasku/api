import { importPKCS8, importSPKI, jwtVerify, SignJWT, errors } from 'jose';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AccessTokenPayload, TokenServicePort } from '../application/ports/token-service.port';

export interface JwtTokenServiceOptions {
  privateKeyPem: string;
  publicKeyPem: string;
  accessTokenTtlSeconds: number;
}

/** Normalisasi klaim role: token baru bawa `roles[]`, token legacy bawa `role`. */
function normalizeRoleClaims(payload: Record<string, unknown>): { roles: string[]; role: string } {
  const rolesClaim = payload.roles;
  const roles =
    Array.isArray(rolesClaim) && rolesClaim.every((r) => typeof r === 'string')
      ? (rolesClaim as string[])
      : typeof payload.role === 'string' && payload.role !== ''
        ? [payload.role] // token legacy single role -> anggap satu role
        : [];
  if (roles.length === 0) {
    throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak valid');
  }
  // @deprecated wire compat - role tertinggi (urutan di user.entity ROLE_RANK)
  const rank: Record<string, number> = { root: 5, admin: 4, reviewer: 3, editor: 2, contributor: 1 };
  let role = roles[0];
  for (const r of roles) if ((rank[r] ?? 0) > (rank[role] ?? 0)) role = r;
  return { roles, role };
}

// RS256: private key menandatangani, public key memverifikasi -
// service yang hanya perlu verifikasi tidak perlu pegang private key.
export class JwtTokenService implements TokenServicePort {
  private privateKeyPromise?: Promise<CryptoKey>;
  private publicKeyPromise?: Promise<CryptoKey>;

  constructor(private readonly opts: JwtTokenServiceOptions) {}

  private async privateKey(): Promise<CryptoKey> {
    this.privateKeyPromise ??= importPKCS8(this.opts.privateKeyPem, 'RS256');
    return this.privateKeyPromise;
  }

  private async publicKey(): Promise<CryptoKey> {
    this.publicKeyPromise ??= importSPKI(this.opts.publicKeyPem, 'RS256');
    return this.publicKeyPromise;
  }

  async generateAccessToken(payload: AccessTokenPayload): Promise<string> {
    return new SignJWT({
      roles: payload.roles,
      // @deprecated wire compat untuk client lama; dihapus saat semua client baca roles
      role: payload.role,
      ...(payload.username ? { username: payload.username } : {}),
      ...(payload.azp ? { azp: payload.azp } : {}),
      ...(payload.scope ? { scope: payload.scope } : {}),
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(payload.user_id)
      .setIssuedAt()
      .setExpirationTime(`${this.opts.accessTokenTtlSeconds}s`)
      .sign(await this.privateKey());
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, await this.publicKey());
      const user_id = payload.sub;
      if (!user_id) {
        throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak valid');
      }
      const { roles, role } = normalizeRoleClaims(payload);
      const azp = typeof payload.azp === 'string' ? payload.azp : undefined;
      const scope = typeof payload.scope === 'string' ? payload.scope : undefined;
      const username = typeof payload.username === 'string' ? payload.username : undefined;
      return { user_id, roles, role, username, azp, scope };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      if (err instanceof errors.JWTExpired) {
        throw new UnauthorizedError('TOKEN_EXPIRED', 'Access token kadaluarsa');
      }
      throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak valid');
    }
  }
}
