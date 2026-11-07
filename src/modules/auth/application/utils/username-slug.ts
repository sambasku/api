import { randomInt } from 'node:crypto';
import { isReservedHandle } from './reserved-handles';

/** Handle mention: a-z, 0-9, titik, underscore. Tanpa hyphen. Min 6 (profesional). */
export const USERNAME_HANDLE_REGEX = /^[a-z0-9._]{6,30}$/;

const MAX_LEN = 30;
const MIN_LEN = 6;

export type UsernameConflictProvider = 'google' | 'github' | 'facebook' | 'email' | 'x';

/**
 * Normalisasi charset saja (tanpa pad / fallback `user`).
 * Dipakai untuk memutus preferensi nama vs email sebelum padding.
 */
export function normalizeUsernameSlug(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/[._]+$/g, '')
    .replace(/^[._]+/g, '')
    .slice(0, MAX_LEN);
}

/**
 * Normalisasi ke handle username (lowercase, charset aman untuk @mention).
 * Spasi / karakter asing / hyphen → underscore.
 * Kosong / terlalu pendek → fallback `user` (+ padding bila perlu).
 */
export function slugifyUsername(raw: string | null | undefined): string {
  const base = normalizeUsernameSlug(raw);

  if (base.length >= MIN_LEN && USERNAME_HANDLE_REGEX.test(base)) return base;
  if (base.length > 0 && base.length < MIN_LEN) {
    const padded = `${base}${'0'.repeat(MIN_LEN - base.length)}`;
    return padded.slice(0, MAX_LEN);
  }
  // Fallback tetap memenuhi min 6 (bukan `user` yang 4 huruf).
  return 'user00';
}

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

function pickBaseHandle(
  preferredRaw: string | null | undefined,
  emailFallback?: string | null,
): string {
  const fromEmail = emailFallback?.split('@')[0] ?? '';
  const nameSlug = normalizeUsernameSlug(preferredRaw);
  const emailSlug = normalizeUsernameSlug(fromEmail);

  // Nama sudah memenuhi min → pakai nama.
  if (nameSlug.length >= MIN_LEN && USERNAME_HANDLE_REGEX.test(nameSlug)) {
    return nameSlug;
  }
  // Nama pendek / kosong → prefer local-part email bila valid & cukup panjang.
  if (emailSlug.length >= MIN_LEN && USERNAME_HANDLE_REGEX.test(emailSlug)) {
    return emailSlug;
  }
  // Pad nama pendek, atau email pendek, atau fallback `user00`.
  let base = slugifyUsername(preferredRaw || fromEmail || 'user00');
  if ((base === 'user00' || base === 'user') && fromEmail) {
    base = slugifyUsername(fromEmail);
  }
  return base;
}

/** Batas kandidat per alokasi - konflik realistis selesai di 1-2 kandidat. */
export const USERNAME_CANDIDATE_LADDER = [1, 24, 12, 4] as const;

/**
 * Daftar kandidat username berurutan untuk insert-retry (TANPA probe SELECT):
 * [base, base_provider, base_xxxxx_provider x24, xxxxx_provider x12,
 * user_xxxxxxxxxx x4].
 *
 * Konflik diselesaikan DB lewat UNIQUE constraint (loop insert di repo,
 * retry kandidat berikutnya) - bukan probe-then-insert yang race-prone
 * (TOCTOU) dan boros subrequest Turso. Urutan = preferensi tampilan:
 * kandidat pertama yang lolos insert jadi handle final.
 *
 * Dipakai Google / GitHub / Facebook / email register (dan X nanti via
 * conflictProvider `'x'`).
 */
function ensureNotReservedHandle(
  base: string,
  preferredRaw: string | null | undefined,
  emailFallback?: string | null,
): string {
  const preferredSlug = normalizeUsernameSlug(preferredRaw);
  const emailSlug = normalizeUsernameSlug(emailFallback?.split('@')[0] ?? '');
  // Nama/email reserved yang kependekan bisa ter-pad (admin → admin0).
  // Bandingkan ke sumber asli supaya tidak lolos shadowing.
  for (const source of [preferredSlug, emailSlug]) {
    if (!source || !isReservedHandle(source)) continue;
    if (base === source || base === slugifyUsername(source)) {
      return `${source}_user`.slice(0, MAX_LEN);
    }
  }
  if (isReservedHandle(base)) return `${base}_user`.slice(0, MAX_LEN);
  return base;
}

export function buildUsernameCandidates(
  preferredRaw: string | null | undefined,
  emailFallback?: string | null,
  conflictProvider?: UsernameConflictProvider,
): string[] {
  let base2 = ensureNotReservedHandle(
    pickBaseHandle(preferredRaw, emailFallback),
    preferredRaw,
    emailFallback,
  );
  // Jamin kandidat pertama selalu lolos regex (reserved_user pendek, dll.).
  if (!USERNAME_HANDLE_REGEX.test(base2)) {
    base2 = slugifyUsername(base2);
  }
  const provider = conflictProvider ?? 'email';
  const out: string[] = [base2];
  const push = (candidate: string) => {
    if (!out.includes(candidate)) out.push(candidate);
  };

  push(fitCandidate(base2, `_${provider}`));
  for (let i = 0; i < USERNAME_CANDIDATE_LADDER[1]; i++) {
    push(fitCandidate(base2, `_${randomUsernameToken(5)}_${provider}`));
  }
  for (let i = 0; i < USERNAME_CANDIDATE_LADDER[2]; i++) {
    const candidate = `${randomUsernameToken(5)}_${provider}`.slice(0, MAX_LEN);
    if (USERNAME_HANDLE_REGEX.test(candidate)) push(candidate);
  }
  // ponytail: fallback terakhir tanpa kaitan input user - ruang ~36^10,
  // praktis tak mungkin habis; kalau suatu hari penuh, naikkan panjang token.
  for (let i = 0; i < USERNAME_CANDIDATE_LADDER[3]; i++) {
    push(`user_${randomUsernameToken(10)}`);
  }
  return out;
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
