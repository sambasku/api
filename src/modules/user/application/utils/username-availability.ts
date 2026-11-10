import {
  normalizeUsernameSlug,
  USERNAME_HANDLE_REGEX,
} from '@/modules/auth/application/utils/username-slug';
import { isReservedHandle } from '@/modules/auth/application/utils/reserved-handles';

export type UsernameAvailabilityStatus =
  | 'available'
  | 'current'
  | 'invalid'
  | 'reserved'
  | 'taken';

export interface UsernameAvailabilityResult {
  username: string;
  status: UsernameAvailabilityStatus;
}

/**
 * Klasifikasi format + reserved tanpa DB. Dipakai validator ringan /
 * gate awal sebelum cek uniqueness.
 */
export function classifyUsernameLocal(
  raw: string,
): UsernameAvailabilityResult {
  const username = normalizeUsernameSlug(raw);
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
 * `current` = sama dengan handle sekarang (case-insensitive setelah normalize).
 */
export async function resolveUsernameAvailability(opts: {
  raw: string;
  currentUsername: string;
  currentUserId: string;
  findByUsername: (username: string) => Promise<{ id: string } | null>;
}): Promise<UsernameAvailabilityResult> {
  const local = classifyUsernameLocal(opts.raw);
  if (local.status === 'invalid' || local.status === 'reserved') {
    return local;
  }

  if (local.username === normalizeUsernameSlug(opts.currentUsername)) {
    return { username: local.username, status: 'current' };
  }

  const other = await opts.findByUsername(local.username);
  if (other && other.id !== opts.currentUserId) {
    return { username: local.username, status: 'taken' };
  }

  return { username: local.username, status: 'available' };
}
