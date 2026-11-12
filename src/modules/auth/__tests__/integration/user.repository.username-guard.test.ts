import { beforeEach, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import { getTestDb } from '@/shared/database/drizzle/test-client';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import { UserRepositoryImpl } from '../../infrastructure/user.repository.impl';
import { buildUsernameCandidates } from '../../application/utils/username-slug';
// Test hanya jalan kalau .env.test ada dengan DATABASE_URL test (api-base-stack.md Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

/**
 * Regression unhandled 500 register "fedi" (Nov 2026): app versi lama
 * (MIN_LEN 3) insert ke DB dengan trigger guard min 6. Retry loop repo
 * harus memperlakukan ABORT trigger sebagai kondisi coba-kandidat-berikutnya
 * - bukan rethrow 500.
 */
describe.skipIf(!hasTestDb)('UserRepositoryImpl - username handle guard', () => {
  const testDb = hasTestDb ? getTestDb() : null!;
  const repo = new UserRepositoryImpl(testDb);

  beforeEach(async () => {
    await truncateAll(testDb);
  });

  it('kandidat pendek ditolak trigger → kandidat valid berikutnya dipakai', async () => {
    // Simulasi versi lama: kandidat pertama 'fedi' (4 huruf, lolos MIN_LEN 3
    // app lama) + kandidat berikutnya valid min 6 (output buildUsernameCandidates baru).
    const candidates = ['fedi', ...buildUsernameCandidates('Fedi', null, 'email')].filter(
      (c, i, arr) => arr.indexOf(c) === i,
    );
    expect(candidates[0]).toBe('fedi');

    const saved = await repo.save({
      username: candidates[0],
      usernameCandidates: candidates,
      email: 'fedi-guard@test.com',
      phone: null,
      passwordHash: 'hash',
    });

    // Kandidat pertama ditolak trigger min 6; kandidat berikutnya (pad/fallback)
    // harus dipakai - bukan melempar 500.
    expect(saved.username).not.toBe('fedi');
    expect(saved.username).toMatch(/^[a-z0-9._]{6,30}$/);
  });

  it('semua kandidat pendek → USERNAME_ALREADY_EXISTS (409), bukan 500', async () => {
    await expect(
      repo.save({
        username: 'fedi',
        usernameCandidates: ['fedi'],
        email: 'fedi-409@test.com',
        phone: null,
        passwordHash: 'hash',
      }),
    ).rejects.toMatchObject({ errorCode: 'USERNAME_ALREADY_EXISTS', statusCode: 409 });
  });
});
