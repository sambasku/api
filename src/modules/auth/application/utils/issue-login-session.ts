import type { LoginMeta } from '../dto/login.dto';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { TokenServicePort } from '../ports/token-service.port';
import { generateToken } from './token';
import { derivePrimaryRole } from '@/shared/utils/derive-primary-role';

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string; // plain - di-hash hanya saat disimpan
  user: {
    id: string;
    username: string;
    displayName: string;
    /** Semua role (multi role) - sumber kebenaran. */
    roles: string[];
    /** @deprecated Derived tertinggi dari roles (wire compat). */
    role: string;
    avatarUrl: string | null;
  };
}

export async function issueLoginSession(
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    roles: string[];
    avatarUrl?: string | null;
  },
  deps: {
    tokenService: TokenServicePort;
    refreshTokenRepo: RefreshTokenRepository;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
  },
  meta: LoginMeta = {},
): Promise<LoginResult> {
  // Akun OAuth lama sempat tanpa baris user_roles → roles []. JWT dengan
  // roles:[] ditolak verify (array kosong menang dari fallback klaim `role`).
  // Token harus selalu non-empty supaya GET /users/me tidak 401 setelah login.
  const roles = user.roles.length > 0 ? user.roles : (['contributor'] as const);
  // @deprecated claim `role` = tertinggi dari roles, untuk client lama
  const primaryRole = derivePrimaryRole(roles);
  const accessToken = await deps.tokenService.generateAccessToken({
    user_id: user.id,
    roles: [...roles],
    role: primaryRole,
    username: user.username,
    ...(meta.clientId ? { azp: meta.clientId } : {}),
    ...(meta.scopes ? { scope: meta.scopes } : {}),
  });

  const { token, tokenHash } = generateToken();
  await deps.refreshTokenRepo.create({
    userId: user.id,
    tokenHash,
    clientId: meta.clientId ?? null,
    deviceInfo: meta.deviceInfo ?? null,
    ipAddress: meta.ipAddress ?? null,
    expiresAt: new Date(Date.now() + deps.refreshTokenTtlSeconds * 1000),
  });

  return {
    accessToken,
    expiresIn: deps.accessTokenTtlSeconds,
    refreshToken: token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName?.trim() || user.username,
      roles: [...roles],
      role: primaryRole,
      avatarUrl: user.avatarUrl ?? null,
    },
  };
}
