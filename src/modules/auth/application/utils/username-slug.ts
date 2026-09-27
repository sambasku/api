import { randomInt } from 'node:crypto';

/** Handle mention: a-z, 0-9, titik, underscore. Tanpa hyphen. */
export const USERNAME_HANDLE_REGEX = /^[a-z0-9._]{3,30}$/;

const MAX_LEN = 30;
const MIN_LEN = 3;

export type UsernameConflictProvider = 'google' | 'github' | 'facebook' | 'email';

/**
 * Normalisasi ke handle username (lowercase, charset aman untuk @mention).
 * Spasi / karakter asing / hyphen → underscore.
 * Kosong / terlalu pendek → fallback `user` (+ padding bila perlu).
 */
export function slugifyUsername(raw: string | null | undefined): string {
  const base = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/[._]+$/g, '')
    .replace(/^[._]+/g, '')
    .slice(0, MAX_LEN);

  if (base.length >= MIN_LEN && USERNAME_HANDLE_REGEX.test(base)) return base;
  if (base.length > 0 && base.length < MIN_LEN) {
    const padded = `${base}${'0'.repeat(MIN_LEN - base.length)}`;
    return padded.slice(0, MAX_LEN);
  }
  return 'user';
}

export type FindByUsername = (username: string) => Promise<unknown | null>;

/** 5 karakter acak [a-z0-9] untuk sufiks konflik. */
export function randomUsernameToken(length = 5): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return out;
}

function fitCandidate(base: string, suffix: string): string {
  const room = Math.max(MIN_LEN, MAX_LEN - suffix.length);
  const head = base.slice(0, room).replace(/[._]+$/g, '');
  const merged = `${head}${suffix}`;
  if (USERNAME_HANDLE_REGEX.test(merged)) return merged;
  return merged.replace(/-/g, '_').slice(0, MAX_LEN);
}

/**
 * Slug unik.
 * - Bebas → original slug.
 * - Bentrok + provider → coba `base_provider`, lalu `base_xxxxx_provider`
 *   (xxxxx = 5 char acak). Tanpa provider (email): `base_xxxxx`.
 */
export async function allocateUniqueUsername(
  findByUsername: FindByUsername,
  preferredRaw: string | null | undefined,
  emailFallback?: string | null,
  conflictProvider?: UsernameConflictProvider,
): Promise<string> {
  const fromEmail = emailFallback?.split('@')[0] ?? '';
  let base = slugifyUsername(preferredRaw || fromEmail || 'user');
  if (base === 'user' && fromEmail) {
    base = slugifyUsername(fromEmail);
  }

  if (!(await findByUsername(base))) return base;

  const provider = conflictProvider ?? 'email';

  const withProvider = fitCandidate(base, `_${provider}`);
  if (withProvider !== base && !(await findByUsername(withProvider))) {
    return withProvider;
  }

  for (let i = 0; i < 24; i++) {
    const token = randomUsernameToken(5);
    const candidate = fitCandidate(base, `_${token}_${provider}`);
    if (!(await findByUsername(candidate))) return candidate;
  }

  for (let i = 0; i < 12; i++) {
    const token = randomUsernameToken(5);
    const candidate = `${token}_${provider}`.slice(0, MAX_LEN);
    if (USERNAME_HANDLE_REGEX.test(candidate) && !(await findByUsername(candidate))) {
      return candidate;
    }
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
