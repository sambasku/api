import { ANONIM_USERNAME } from '@/shared/constants/anonim';

/**
 * Handle yang tidak boleh dipakai user baru:
 * - segment route API yang bentrok dengan `GET /api/v1/users/:username`
 *   (route statis menang atas route param, jadi handle yang sama tidak punya
 *   halaman profil publik)
 * - nama peran/role
 * - user sistem (anonim + importer)
 *
 * Daftar ini ringkas - sumber kebenaran tetap route table.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Segment route di bawah /api/v1/users (publik, tanpa auth)
  'me',
  'suggest',
  'activity',
  'avatar',
  'achievements',
  // Auth & user
  'login',
  'register',
  'logout',
  'refresh',
  'users',
  'admin',
  'root',
  'auth',
  'account',
  'settings',
  'password',
  // Peran
  'contributor',
  'editor',
  'reviewer',
  'verifier',
  // User sistem
  ANONIM_USERNAME,
  'sistem',
  'system',
]);

/** True bila handle termasuk reserved (tidak boleh dipakai user baru). */
export function isReservedHandle(username: string): boolean {
  return RESERVED_HANDLES.has(username.toLowerCase());
}
