import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { config } from 'dotenv';

import { getTestDb } from '@/shared/database/drizzle/test-client';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import {
  languages,
  meanings,
  users,
  wordClasses,
  words,
} from '@/shared/database/drizzle/schema';

import { LEMMA_MERGE_TX_OPTIONS } from '../../application/utils/merge-word-entries-options';
import { mergeWordEntriesInTx } from '../../infrastructure/merge-duplicate-words';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

/**
 * Gabung lemma (mergeWordEntriesInTx): status verif makna harus terjaga.
 * - Makna sumber yang belum verif tetap belum verif setelah dipindah.
 * - Makna sumber yang verif tetap verif setelah dipindah.
 * - Duplikat (sidik sama) yang verif mewariskan verif ke makna penunggu yang belum verif.
 */
describe.skipIf(!hasTestDb)('mergeWordEntriesInTx verifikasi makna (integration)', () => {
  const db = hasTestDb ? getTestDb() : null!;

  async function seed() {
    await db.insert(users).values({ id: 'u1', username: 'mergeverif', email: 'mv@test.com', passwordHash: 'x' });
    await db.insert(languages).values([{ id: 'smb', code: 'smb', name: 'Sambas' }]);
    await db.insert(wordClasses).values({ id: 'n', code: 'n', name: 'Nomina' });
    await db.insert(words).values([
      { id: 'keep', lemma: 'asin', languageId: 'smb', wordType: 'word', status: 'published', isVerified: false, isCorrected: false, createdBy: 'u1' },
      { id: 'src', lemma: 'Asin', languageId: 'smb', wordType: 'word', status: 'published', isVerified: true, isCorrected: false, createdBy: 'u1' },
    ]);
    await db.insert(meanings).values([
      // Penunggu: belum verif.
      { id: 'mk1', wordId: 'keep', wordClassId: 'n', definition: 'rasa garam', orderIndex: 0, status: 'published', isVerified: false, isCorrected: false, createdBy: 'u1' },
      // Sumber: duplikat (sidik sama) dan verif -> harus mewariskan verif ke mk1.
      { id: 'ms1', wordId: 'src', wordClassId: 'n', definition: 'rasa garam', orderIndex: 0, status: 'published', isVerified: true, verifiedBy: 'u1', verifiedAt: new Date(5000), isCorrected: false, createdBy: 'u1' },
      // Sumber: makna baru belum verif -> tetap belum verif.
      { id: 'ms2', wordId: 'src', wordClassId: 'n', definition: 'tidak tawar', orderIndex: 1, status: 'published', isVerified: false, isCorrected: false, createdBy: 'u1' },
      // Sumber: makna baru verif -> tetap verif.
      { id: 'ms3', wordId: 'src', wordClassId: 'n', definition: 'asin sekali', orderIndex: 2, status: 'published', isVerified: true, verifiedBy: 'u1', verifiedAt: new Date(6000), isCorrected: false, createdBy: 'u1' },
    ]);
  }

  it('menjaga status verif makna dan mewariskan verif dari duplikat', async () => {
    await truncateAll(db);
    await seed();

    await mergeWordEntriesInTx(db, 'keep', ['src'], 'u1', LEMMA_MERGE_TX_OPTIONS);

    const rows = await db.select().from(meanings);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Duplikat dibuang, verif diwariskan ke penunggu.
    expect(byId.get('ms1')?.deletedAt).not.toBeNull();
    expect(byId.get('mk1')).toMatchObject({ wordId: 'keep', isVerified: true, verifiedBy: 'u1' });
    expect(byId.get('mk1')?.verifiedAt).toEqual(new Date(5000));

    // Makna baru dipindah apa adanya.
    expect(byId.get('ms2')).toMatchObject({ wordId: 'keep', isVerified: false, verifiedBy: null });
    expect(byId.get('ms3')).toMatchObject({ wordId: 'keep', isVerified: true, verifiedBy: 'u1' });

    const [src] = await db.select().from(words).where(eq(words.id, 'src'));
    expect(src?.deletedAt).not.toBeNull();
  });
});
