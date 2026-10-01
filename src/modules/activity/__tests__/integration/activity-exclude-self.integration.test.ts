import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { ActivityRepositoryImpl } from '@/modules/activity/infrastructure/activity.repository.impl';
import { ListActivityUseCase } from '@/modules/activity/application/use-cases/list-activity.use-case';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const SELF = '01EXCLSELF0USER';
const OTHER = '01EXCLOTHERUSER';

/**
 * `exclude_self` hanya berguna kalau penyaringannya terjadi DI SQL.
 *
 * Alasannya cap per jenis: `mergeActivityFeed` mengambil maksimal 4 baris per
 * jenis dari pool yang tiap sumbernya cuma ambil 8 baris (`ACTIVITY_PER_SOURCE`).
 * Kalau penyaringan baru jalan setelah baris masuk memory, 4 baris milik sendiri
 * tetap memakan 4 slot jenis itu dan jenisnya hilang dari halaman - baris yang
 * terbuang tidak bisa di-backfill karena `limit` sudah terpakai di query.
 *
 * Fixture di bawah sengaja dibuat ekstrem: 8 komentar terbaru milik SELF,
 * sedangkan 8 komentar OTHER lebih tua. Pembeda dua implementasi:
 * - penyaringan di memory → 0 komentar di feed (jenis hilang)
 * - penyaringan di SQL → 4 slot terisi komentar OTHER
 */
describe.skipIf(!hasTestDb)('ActivityRepositoryImpl - excludeSelfUserId (integration)', () => {
  let repo: ActivityRepositoryImpl;

  const BASE = Math.floor(Date.now() / 1000) - 10_000;
  const SELF_COMMENTS = Array.from({ length: 8 }, (_, i) => `01EXCLSELFCMT${i}`);
  const OTHER_COMMENTS = Array.from({ length: 8 }, (_, i) => `01EXCLOTHCMT${i}`);

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, languages, words, comments } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    await db
      .insert(languages)
      .values({ id: '01EXCLSELFLANG', code: 'exl', name: 'Exclude' })
      .onConflictDoNothing();

    await db.insert(users).values([
      {
        id: SELF,
        username: 'excl_self',
        displayName: 'Exclude Self',
        email: 'excl-self@test.com',
        passwordHash: 'x',
        role: 'contributor',
        emailVerified: true,
        emailVerifiedAt: new Date((BASE + 400) * 1000),
      },
      {
        id: OTHER,
        username: 'excl_other',
        displayName: 'Exclude Other',
        email: 'excl-other@test.com',
        passwordHash: 'x',
        role: 'contributor',
        emailVerified: true,
        emailVerifiedAt: new Date((BASE + 300) * 1000),
      },
    ]);

    // Kata milik SELF (harus hilang) + kata impor sistem `createdBy` NULL
    // (harus TETAP ada: `NULL <> 'x'` di SQL itu NULL, bukan true).
    await db.insert(words).values([
      {
        id: '01EXCLSELFWORD',
        lemma: 'kumisjari',
        languageId: '01EXCLSELFLANG',
        status: 'published',
        createdBy: SELF,
        createdAt: new Date(BASE * 1000),
      },
      {
        id: '01EXCLIMPORTWORD',
        lemma: 'batuaras',
        languageId: '01EXCLSELFLANG',
        status: 'published',
        createdBy: null,
        createdAt: new Date((BASE - 1) * 1000),
      },
    ]);

    // SELF newest, OTHER lebih tua. Satu detik per baris.
    await db.insert(comments).values([
      ...SELF_COMMENTS.map((id, i) => ({
        id,
        wordId: '01EXCLSELFWORD',
        userId: SELF,
        body: `self ${i}`,
        status: 'published' as const,
        createdAt: new Date((BASE + 200 - i) * 1000),
      })),
      ...OTHER_COMMENTS.map((id, i) => ({
        id,
        wordId: '01EXCLSELFWORD',
        userId: OTHER,
        body: `other ${i}`,
        status: 'published' as const,
        createdAt: new Date((BASE + 100 - i) * 1000),
      })),
    ]);

    repo = new ActivityRepositoryImpl(db);
  });

  it('tanpa excludeUserId feed tetap utuh (perilaku lama)', async () => {
    const rows = await repo.listRecentComments(8);
    expect(rows).toHaveLength(8);
    // 8 terbaru semuanya punya SELF.
    expect(new Set(rows.map((r) => r.actor?.username))).toEqual(
      new Set(['excl_self']),
    );
  });

  it('excludeUserId: 8 baris terbaru yang dikembalikan semua milik OTHER', async () => {
    // Inilah bukti penyaringan terjadi sebelum LIMIT. Kalau baru di memory,
    // hasil query ini tetap 8 baris SELF lalu dibuang semua → array kosong.
    const rows = await repo.listRecentComments(8, undefined, SELF);

    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((r) => r.actor?.username))).toEqual(
      new Set(['excl_other']),
    );
  });

  it('jenis komentar tidak hilang dari feed setelah exclude (cap 4 per jenis)', async () => {
    const page = await new ListActivityUseCase(repo).execute({
      limit: 20,
      excludeUserId: SELF,
    });

    const comments = page.items.filter((i) => i.kind === 'comment');
    // Cap per jenis = 4. Kalau penyaringan di memory, jumlah ini 0.
    expect(comments).toHaveLength(4);
    expect(new Set(comments.map((c) => c.actor?.username))).toEqual(
      new Set(['excl_other']),
    );
  });

  it('kata milik sendiri disembunyikan, kata impor (createdBy NULL) tetap ada', async () => {
    const rows = await repo.listRecentWords(8, undefined, SELF);
    const ids = rows.map((r) => r.id);

    expect(ids).toContain('word:01EXCLIMPORTWORD');
    expect(ids).not.toContain('word:01EXCLSELFWORD');
  });

  it('baris selamat datang milik sendiri disembunyikan', async () => {
    const rows = await repo.listRecentWelcomes(8, undefined, SELF);
    expect(rows.map((r) => r.id)).toEqual(['welcome:' + OTHER]);
  });
});