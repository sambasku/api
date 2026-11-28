import { createMiddleware } from 'hono/factory';
import type { AppVariables } from '@/shared/types';
import { ROLE_RANK, type UserRole } from '@/modules/auth/domain/entities/user.entity';

/** Level tertinggi dari roles token. Role tak dikenal bernilai 0 (fail-closed). */
function levelOf(roles: readonly string[]): number {
  let level = 0;
  for (const r of roles) {
    if (Object.hasOwn(ROLE_RANK, r)) level = Math.max(level, ROLE_RANK[r as UserRole]);
  }
  return level;
}

/**
 * Gate berbasis LEVEL role (`ROLE_RANK`), bukan daftar nama: lolos bila level
 * tertinggi user >= level `min`. `requireMinRole('admin')` = admin dan root
 * (root lebih tinggi). Reviewer, editor, contributor, role tak dikenal, atau
 * tanpa user = 403. Dipakai untuk data sensitif (keuangan) supaya route baru
 * di router yang sama tidak bisa lupa membatasi role.
 */
export function requireMinRole(min: UserRole) {
  const minLevel = ROLE_RANK[min];
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get('user');
    if (!user || levelOf(user.roles ?? []) < minLevel) {
      return c.json(
        {
          success: false as const,
          error_code: 'FORBIDDEN',
          message: 'Kamu belum punya akses untuk fitur ini.',
          details: null,
        },
        403,
      );
    }
    await next();
  });
}

// Factory: authorizeRole('admin', 'editor') - dipakai proteksi endpoint
// modul lain (misal POST /api/v1/admin/words dari modul word).
// Multi role: user lolos bila punya SALAH SATU role yang diizinkan.
export function authorizeRole(...allowedRoles: string[]) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get('user');
    const hasAny = user?.roles.some((r) => allowedRoles.includes(r)) ?? false;
    if (!user || !hasAny) {
      return c.json(
        {
          success: false as const,
          error_code: 'FORBIDDEN',
          message: 'Kamu belum punya akses untuk fitur ini.',
          details: null,
        },
        403,
      );
    }
    await next();
  });
}
