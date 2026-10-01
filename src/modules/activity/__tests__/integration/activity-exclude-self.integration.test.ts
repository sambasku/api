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
      {
        // Satu kata impor lagi hanya untuk target vote (lihat describe vote).
        id: '01EXCLIMPORTWORD2',
        lemma: 'balanga',
        languageId: '01EXCLSELFLANG',
        status: 'published',
        createdBy: null,
        createdAt: new Date((BASE - 2) * 1000),
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

  // ---------------------------------------------------------------------
  // Vote: yang dicek bukan pelaku (sudah di test lain) tapi TARGET. Vote
  // orang lain atas kata milik sendiri bukan "karya orang lain".
  //
  // Fixture dibuat ekstrem seperti di atas: 8 vote terbaru (oleh OTHER, jadi
  // pelaku lolos) semuanya menunjuk kata milik SELF. Kalau penyaringan target
  // baru jalan setelah query, 8 baris itu tetap memakan limit dan vote OTHER
  // yang menyasar kata orang lain hilang dari hasil.
  //
  // BUTUH 8 kata berbeda: `votes_user_target_unique (user_id, entity_type,
  // entity_id)` melarang satu user punya dua vote untuk target yang sama, jadi
  // "8 vote ke satu kata" tidak bisa jadi fixture - harus 8 kata.
  // ---------------------------------------------------------------------
  describe('vote atas kata milik sendiri', () => {
    const SELF_VOTE_TARGETS = Array.from(
      { length: 8 },
      (_, i) => `01EXCLVOWRD${String(i).padStart(4, '0')}X`,
    );

    beforeAll(async () => {
      const { getTestDb } = await import('@/shared/database/drizzle/test-client');
      const { votes, words } = await import('@/shared/database/drizzle/schema');
      const db = getTestDb();

      await db
        .insert(words)
        .values(
          SELF_VOTE_TARGETS.map((id, i) => ({
            id,
            lemma: `votetarget${i}`,
            languageId: '01EXCLSELFLANG',
            status: 'published' as const,
            createdBy: SELF,
            createdAt: new Date((BASE - 100 - i) * 1000),
          })),
        )
        .onConflictDoNothing();

      await db
        .insert(votes)
        .values([
          // 8 vote TERBARU oleh OTHER atas 8 kata milik SELF - harus hilang.
          ...SELF_VOTE_TARGETS.map((targetId, i) => ({
            id: `01EXCLVOTESELF${i}`,
            userId: OTHER,
            entityType: 'word',
            entityId: targetId,
            value: 1,
            createdAt: new Date((BASE + 300 + i) * 1000),
          })),
          // 2 vote lebih tua oleh OTHER atas 2 kata milik OTHER (created_by
          // NULL = impor sistem) - harus tetap ada, membuktikan slot tidak
          // hilang begitu saja. Dua TARGET berbeda: unique index
          // (user_id, entity_type, entity_id) menolak dua vote dengan target sama.
          {
            id: '01EXCLVOTEOTHER00',
            userId: OTHER,
            entityType: 'word',
            entityId: '01EXCLIMPORTWORD',
            value: 1,
            createdAt: new Date((BASE + 250) * 1000),
          },
          {
            id: '01EXCLVOTEOTHER01',
            userId: OTHER,
            entityType: 'word',
            entityId: '01EXCLIMPORTWORD2',
            value: -1,
            createdAt: new Date((BASE + 249) * 1000),
          },
        ])
        .onConflictDoNothing();
    });

    it('vote orang lain atas kata sendiri dibuang, vote di kata orang lain kept', async () => {
      const rows = await repo.listRecentVotes(10, undefined, SELF);
      const ids = rows.map((r) => r.id);

      expect(ids).not.toContain('vote:01EXCLVOTESELF0');
      expect(ids).toContain('vote:01EXCLVOTEOTHER00');
      // 2 baris yang tersisa, bukan 0: penyaringan terjadi sebelum LIMIT.
      expect(rows).toHaveLength(2);
    });

    it('tanpa excludeUserId semua vote tetap tampil (feed publik utuh)', async () => {
      const rows = await repo.listRecentVotes(10);
      expect(rows).toHaveLength(10);
      expect(rows.map((r) => r.id)).toContain('vote:01EXCLVOTESELF0');
    });
  });

  // ---------------------------------------------------------------------
  // Search-miss: tidak punya "pemilik", tapi pemicunya bisa dilacak lewat
  // `search_miss_searchers`. Satu baris miss dipakai bersama semua orang
  // yang mencari istilah sama - jadi yang disembunyikan HANYA untuk viewer
  // yang ikut mencarinya, bukan untuk semua orang.
  // ---------------------------------------------------------------------
  describe('search miss yang dicari sendiri', () => {
    const SELF_MISS = '01EXCLMISSSELF01';
    const OTHER_MISS = '01EXCLMISSOTHR01';

    beforeAll(async () => {
      const { getTestDb } = await import('@/shared/database/drizzle/test-client');
      const { searchMisses, searchMissSearchers } = await import(
        '@/shared/database/drizzle/schema'
      );
      const db = getTestDb();
      const at = new Date((BASE + 500) * 1000);

      // `is_visible` = true: default-nya false (gate admin), tanpa ini tidak
      // akan pernah muncul di feed dan test jadi tidak berarti apa-apa.
      await db
        .insert(searchMisses)
        .values([
          { id: SELF_MISS, term: 'kalintiak', direction: 'lemma', isVisible: true, lastSearchedAt: at },
          { id: OTHER_MISS, term: 'makatn', direction: 'lemma', isVisible: true, lastSearchedAt: at },
        ])
        .onConflictDoNothing();

      // SELF ikut mencari 'kalintiak'; dia tidak pernah mencari 'makatn'.
      await db
        .insert(searchMissSearchers)
        .values([
          { id: '01EXCLSEARCHERSELF', searchMissId: SELF_MISS, userId: SELF },
          { id: '01EXCLSEARCHEROTHR', searchMissId: OTHER_MISS, userId: OTHER },
        ])
        .onConflictDoNothing();
    });

    it('miss yang dicari sendiri disembunyikan, miss orang lain tetap tampil', async () => {
      const rows = await repo.listRecentVisibleSearchMisses(10, undefined, SELF);
      const ids = rows.map((r) => r.id);

      expect(ids).not.toContain('search_miss:' + SELF_MISS);
      expect(ids).toContain('search_miss:' + OTHER_MISS);
    });

    it('tanpa excludeUserId miss yang dicari sendiri tetap tampil untuk semua', async () => {
      const rows = await repo.listRecentVisibleSearchMisses(10);
      const ids = rows.map((r) => r.id);

      // Kalau ini bocor, search miss yang pernah dicari siapa pun hilang dari
      // feed publik - arah kesalahan yang lebih halus dan lebih jarang.
      expect(ids).toContain('search_miss:' + SELF_MISS);
      expect(ids).toContain('search_miss:' + OTHER_MISS);
    });

    it('user lain tetap melihat miss yang tadi dicari SELF', async () => {
      const rows = await repo.listRecentVisibleSearchMisses(10, undefined, OTHER);
      const ids = rows.map((r) => r.id);

      // Atribusi bersifat per-viewer: miss milik bersama, hanya disembunyikan
      // dari pemicunya.
      expect(ids).toContain('search_miss:' + SELF_MISS);
      expect(ids).not.toContain('search_miss:' + OTHER_MISS);
    });
  });
});