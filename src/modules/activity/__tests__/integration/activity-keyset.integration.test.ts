import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { ActivityRepositoryImpl } from '@/modules/activity/infrastructure/activity.repository.impl';
import type { ActivityCursor } from '@/modules/activity/domain/merge-activity';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Keyset feed diuji langsung ke SQL, bukan lewat HTTP.
 *
 * Feed HTTP tidak bisa membuktikan apa pun soal keyset: `mergeActivityFeed`
 * memfilter ulang dengan `isStrictlyOlderThan` di JS, jadi klausa SQL yang
 * salah diam-diam tertutup dan paginasi tetap "berhasil" pada data sedikit.
 * Yang rusak sebenarnya isi kuerinya: kursor terikat milidetik membuat
 * `ts < ms` selalu benar, sehingga tiap sumber mengembalikan baris yang sama
 * dengan halaman sebelumnya. Di feed padat itu menjadi halaman kosong.
 */
describe.skipIf(!hasTestDb)('ActivityRepositoryImpl - keyset cursor (integration)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: ActivityRepositoryImpl;

  const BASE = Math.floor(Date.now() / 1000) - 10_000;
  const COMMENT_COUNT = 6;
  const IDS = Array.from({ length: COMMENT_COUNT }, (_, i) => `01CURKEYSET${i}`);

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, languages, words, comments } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    const [lang] = await db
      .insert(languages)
      .values({ id: '01CURKEYSETLANG', code: 'kst', name: 'Keyset' })
      .onConflictDoNothing()
      .returning();
    const languageId = lang?.id ?? '01CURKEYSETLANG';

    const [user] = await db
      .insert(users)
      .values({
        id: '01CURKEYSETUSER',
        username: 'keyset_user',
        displayName: 'Keyset User',
        email: 'keyset@test.com',
        passwordHash: 'x',
        role: 'contributor',
      })
      .returning();

    const [word] = await db
      .insert(words)
      .values({
        id: '01CURKEYSETWORD',
        lemma: 'kuncursor',
        languageId,
        status: 'published',
        createdBy: user!.id,
      })
      .returning();

    // Satu detik per komentar: fixture e2e lain lahir dalam <1 detik, jadi
    // tidak punya "halaman kedua" untuk diuji.
    await db.insert(comments).values(
      IDS.map((id, i) => ({
        id,
        wordId: word!.id,
        userId: user!.id,
        body: `komentar ${i}`,
        status: 'published' as const,
        createdAt: new Date((BASE - i) * 1000),
      })),
    );

    repo = new ActivityRepositoryImpl(db);
  });

  it('halaman berikutnya hanya berisi baris lebih lama, tanpa duplikat', async () => {
    const seen: string[] = [];
    const pageSizes: number[] = [];
    let cursor: ActivityCursor | undefined;
    let guard = 0;

    do {
      const page = await repo.listRecentComments(2, cursor);
      pageSizes.push(page.length);
      for (const item of page) seen.push(item.id);
      const last = page[page.length - 1];
      if (!last) break;
      cursor = { createdAt: last.createdAt, id: last.id };
      guard += 1;
    } while (cursor && guard < 10);

    // Semua baris terlihat tepat sekali (id repo sudah berawalan `comment:`).
    expect(seen.sort()).toEqual(IDS.map((id) => `comment:${id}`).sort());
    // Tiap halaman harus terisi penuh, kecuali satu halaman penutup kosong.
    // Inilah yang gagal kalau kursor terikat milidetik: kueri mengembalikan
    // baris yang sama, `isStrictlyOlderThan` membuangnya, lalu halaman
    // berikutnya kosong padahal masih ada isi.
    expect(pageSizes.slice(0, -1)).toEqual([2, 2, 2]);
    expect(pageSizes.at(-1)).toBe(0);
  });

  it('waktu yang dikembalikan benar-benar epoch detik, bukan milidetik', async () => {
    const [newest] = await repo.listRecentComments(1);
    expect(newest).toBeTruthy();
    // Kalau kolom terbaca ms, year-nya 50.000-an (#47).
    expect(newest!.createdAt.getUTCFullYear()).toBeLessThan(2300);
  });

  it('guard feed menyaring timestamp di luar rentang, walau trigger meloloskannya', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const db = getTestDb();

    // 2e10 detik = tahun 2603. Lolos trigger 0049 (yang baru menolak >= 1e11)
    // tapi ditolak guard feed (1e10). Nilai ini membuktikan guard feed bekerja
    // sendiri, bukan trigger yang menyelamatkan.
    //
    // Kedua kolom waktu dikorupsi: `created_at` tidak boleh NULL, jadi harus
    // diisi angka mustahil juga. Kalau cuma `verified_at` yang rusak, guard
    // dengan benar jatuh ke `created_at` dan kata tetap tampil.
    const impossibleSeconds = 20_000_000_000;
    await db.run(
      sql`UPDATE words SET created_at = ${impossibleSeconds}, verified_at = ${impossibleSeconds}
          WHERE id = '01CURKEYSETWORD'`,
    );

    const [newest] = await repo.listRecentWords(1);
    expect(newest).toBeUndefined();

    // Kembalikan supaya test lain tidak ikut terpengaruh.
    await db.run(
      sql`UPDATE words SET created_at = ${BASE}, verified_at = NULL
          WHERE id = '01CURKEYSETWORD'`,
    );
  });

  it('trigger 0049 menolak penulisan epoch milidetik', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const db = getTestDb();

    // Drizzle membungkus error driver jadi "Failed query: ...", pesan SQLite
    // aslinya ada di `cause`.
    const err = await db
      .run(
        sql`UPDATE words SET verified_at = ${BASE * 1000} WHERE id = '01CURKEYSETWORD'`,
      )
      .then(
        () => null,
        (e: unknown) => e as { message?: string; cause?: { message?: string } },
      );

    expect(err).not.toBeNull();
    expect(err!.cause?.message ?? err!.message).toMatch(/milliseconds/i);
  });
});
