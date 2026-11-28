import {
  normalizeUsernameHandle,
  USERNAME_HANDLE_REGEX,
} from '@/modules/auth/application/utils/username-slug';
import { isReservedHandle } from '@/modules/auth/application/utils/reserved-handles';

export type UsernameAvailabilityStatus =
  | 'available'
  | 'current'
  | 'invalid'
  | 'reserved'
  | 'taken'
  | 'reclaimable';

export interface UsernameAvailabilityResult {
  username: string;
  status: UsernameAvailabilityStatus;
}

/**
 * Klasifikasi format + reserved tanpa DB. Dipakai validator ringan /
 * gate awal sebelum cek uniqueness. Mempertahankan kapitalisasi input.
 */
export function classifyUsernameLocal(
  raw: string,
): UsernameAvailabilityResult {
  const username = normalizeUsernameHandle(raw);
  if (!USERNAME_HANDLE_REGEX.test(username)) {
    return { username, status: 'invalid' };
  }
  if (isReservedHandle(username)) {
    return { username, status: 'reserved' };
  }
  return { username, status: 'available' };
}

/**
 * Status ketersediaan handle untuk user yang sedang login.
 * `current` = sama persis (termasuk kapitalisasi) dengan handle sekarang.
 * Perubahan kapitalisasi saja (mis. `budi00` -> `Budi00`) mengembalikan
 * `available` agar bisa disimpan dan tetap melalui alur cooldown 30 hari.
 * `reclaimable` = masih di-hold oleh user ini (boleh reclaim tanpa cooldown).
 */
export async function resolveUsernameAvailability(opts: {
  raw: string;
  currentUsername: string;
  currentUserId: string;
  findByUsername: (username: string) => Promise<{ id: string } | null>;
  findActiveHold?: (
    username: string,
  ) => Promise<{ userId: string } | null>;
}): Promise<UsernameAvailabilityResult> {
  const local = classifyUsernameLocal(opts.raw);
  if (local.status === 'invalid' || local.status === 'reserved') {
    return local;
  }

  const currentHandle = normalizeUsernameHandle(opts.currentUsername);
  if (local.username === currentHandle) {
    return { username: local.username, status: 'current' };
  }
  if (local.username.toLowerCase() === currentHandle.toLowerCase()) {
    return { username: local.username, status: 'available' };
  }

  const hold = opts.findActiveHold
    ? await opts.findActiveHold(local.username)
    : null;
  if (hold) {
    if (hold.userId === opts.currentUserId) {
      return { username: local.username, status: 'reclaimable' };
    }
    return { username: local.username, status: 'taken' };
  }

  const other = await opts.findByUsername(local.username);
  if (other && other.id !== opts.currentUserId) {
    return { username: local.username, status: 'taken' };
  }

  return { username: local.username, status: 'available' };
}
