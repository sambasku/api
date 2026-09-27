import { randomInt } from 'node:crypto';

/** Handle mention: a-z, 0-9, titik, underscore, hyphen. */
export const USERNAME_HANDLE_REGEX = /^[a-z0-9._-]{3,30}$/;

const MAX_LEN = 30;
const MIN_LEN = 3;

/**
 * Normalisasi ke handle username (lowercase, charset aman untuk @mention).
 * Kosong / terlalu pendek → fallback `user` (+ padding bila perlu).
 */
export function slugifyUsername(raw: string | null | undefined): string {
  const base = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/[._-]+$/g, '')
    .replace(/^[._-]+/g, '')
    .slice(0, MAX_LEN);

  if (base.length >= MIN_LEN && USERNAME_HANDLE_REGEX.test(base)) return base;
  if (base.length > 0 && base.length < MIN_LEN) {
    const padded = `${base}${'0'.repeat(MIN_LEN - base.length)}`;
    return padded.slice(0, MAX_LEN);
  }
  return 'user';
}

export type FindByUsername = (username: string) => Promise<unknown | null>;

/** Slug unik: base, base2..base99, lalu base + 4 digit acak. */
export async function allocateUniqueUsername(
  findByUsername: FindByUsername,
  preferredRaw: string | null | undefined,
  emailFallback?: string | null,
): Promise<string> {
  const fromEmail = emailFallback?.split('@')[0] ?? '';
  let base = slugifyUsername(preferredRaw || fromEmail || 'user');
  if (base === 'user' && fromEmail) {
    base = slugifyUsername(fromEmail);
  }

  if (!(await findByUsername(base))) return base;
  for (let n = 2; n <= 99; n++) {
    const suffix = String(n);
    const candidate = `${base.slice(0, MAX_LEN - suffix.length)}${suffix}`;
    if (!(await findByUsername(candidate))) return candidate;
  }
  for (let i = 0; i < 20; i++) {
    const suffix = randomInt(0, 10_000).toString().padStart(4, '0');
    const candidate = `${base.slice(0, MAX_LEN - suffix.length)}${suffix}`;
    if (!(await findByUsername(candidate))) return candidate;
  }
  return `user${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
}

/** Email sintetis saat conflict / email provider tidak tersedia. */
export function syntheticOauthEmail(provider: 'github' | 'google' | 'facebook', providerUserId: string): string {
  const id = providerUserId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unknown';
  const prefix = provider === 'github' ? 'gh' : provider === 'facebook' ? 'fb' : 'go';
  return `${prefix}_${id}@users.noreply.sambasku.local`;
}

export function isSyntheticOauthEmail(email: string): boolean {
  return email.endsWith('@users.noreply.sambasku.local');
}
