import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { AppError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';

export interface AccessTokenPayload {
  user_id: string; // ULID
  role: string;
  azp?: string;
  scope?: string;
}

type VerifyFn = (token: string) => Promise<AccessTokenPayload>;

/** Dipanggil setelah JWT valid - presence piggyback (best-effort). */
export type OnAuthenticatedFn = (userId: string, c: Context<{ Variables: AppVariables }>) => void;

function unauthorized(c: Context, error_code: string, message: string) {
  return c.json({ success: false as const, error_code, message, details: null }, 401);
}

function scheduleBackground(c: Context, task: Promise<unknown>) {
  const executionCtx = (
    c as Context & { executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } }
  ).executionCtx;
  const safe = task.catch(() => undefined);
  if (executionCtx?.waitUntil) {
    executionCtx.waitUntil(safe);
  } else {
    void safe;
  }
}

function applyUser(c: Context<{ Variables: AppVariables }>, payload: AccessTokenPayload) {
  c.set('user', {
    user_id: payload.user_id,
    role: payload.role,
    azp: payload.azp,
    scope: payload.scope,
  });
}

function notifyAuthenticated(
  c: Context<{ Variables: AppVariables }>,
  userId: string,
  onAuthenticated?: OnAuthenticatedFn,
) {
  if (!onAuthenticated) return;
  try {
    onAuthenticated(userId, c);
  } catch {
    // Presence tidak boleh gagalkan auth.
  }
}

// Factory: verify function di-inject dari composition root (main.ts), supaya
// shared/ tidak import internal modul auth - arah dependency tetap ke dalam.
export function createAuthenticateMiddleware(
  verifyAccessToken: VerifyFn,
  onAuthenticated?: OnAuthenticatedFn,
) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      return unauthorized(c, 'UNAUTHORIZED', 'Token tidak disertakan');
    }

    try {
      const payload = await verifyAccessToken(token);
      applyUser(c, payload);
      notifyAuthenticated(c, payload.user_id, onAuthenticated);
      await next();
    } catch (err) {
      const code = err instanceof AppError && err.errorCode === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED';
      return unauthorized(c, code, 'Token tidak valid atau kadaluarsa');
    }
  });
}

/**
 * Auth opsional: Bearer valid → set `user`; tanpa token → lanjut sebagai tamu.
 * Token invalid/expired tetap 401 (jangan diam-diam jadi anonim).
 * Dipakai endpoint publik yang atribusi bergantung login
 * (mis. POST /contributions/words).
 */
export function createOptionalAuthenticateMiddleware(
  verifyAccessToken: VerifyFn,
  onAuthenticated?: OnAuthenticatedFn,
) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      await next();
      return;
    }

    try {
      const payload = await verifyAccessToken(token);
      applyUser(c, payload);
      notifyAuthenticated(c, payload.user_id, onAuthenticated);
      await next();
    } catch (err) {
      const code = err instanceof AppError && err.errorCode === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED';
      return unauthorized(c, code, 'Token tidak valid atau kadaluarsa');
    }
  });
}

/**
 * Auth "lunak": Bearer valid → set `user`; apa pun yang lain (tanpa header,
 * token rusak, token kedaluarsa) → lanjut sebagai tamu. **Tidak pernah 401.**
 *
 * Beda dari [createOptionalAuthenticateMiddleware] yang sengaja 401 di token
 * buruk: itu untuk endpoint yang atribusi loginnya wajib benar (kontribusi
 * anonim, laporan bug). Yang ini untuk endpoint yang tetap berguna sebagai
 * tamu - hanya lebih kaya saat login, tidak pernah lebih buruk.
 *
 * Dipakai `GET /activity` + query `exclude_self`. Token basi di sana akan
 * memicu refresh + retry lalu 401 apa adanya, sehingga Home error total -
 * padahal feed publiknya tetap bisa dibaca. Di sini token basi hanya berarti
 * "tampilkan feed lengkap".
 *
 * Sengaja tidak menerima `onAuthenticated`: feed adalah baca tinggi frekuensi,
 * presence harus tetap digerakkan aksi nyata, bukan sekadar membuka beranda.
 */
export function createSoftAuthenticateMiddleware(verifyAccessToken: VerifyFn) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      await next();
      return;
    }

    try {
      applyUser(c, await verifyAccessToken(token));
    } catch {
      // Sengaja ditelan. Route ini tidak butuh identitas - tanpa token sah
      // pemanggil tetap dapat feed publik, hanya tanpa penyaringan `exclude_self`.
    }
    await next();
  });
}

/** Export untuk wiring composition root - schedule touch di background. */
export function scheduleAuthenticatedSideEffect(
  c: Context,
  run: () => Promise<unknown>,
) {
  scheduleBackground(c, run());
}
