import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { config } from 'dotenv';

import { getTestDb } from '@/shared/database/drizzle/test-client';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import {
  examples,
  meaningTranslations,
  meaningVoteCounts,
  meanings,
  users,
  votes,
  wordClasses,
  words,
  languages,
} from '@/shared/database/drizzle/schema';

import { applySafeMeaningMerges } from '../../application/merge-duplicate-meanings';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

/**
 * Regression prod (data.sambasku.com): satu transaksi interaktif raksasa
 * untuk semua kelompok membuat hrana menutup transaksi duluan -> rollback
 * gagal "cannot rollback - no transaction is active" dan menelan error
 * asli. applySafeMeaningMerges kini per kelompok + idempoten saat rerun.
 */
describe.skipIf(!hasTestDb)('applySafeMeaningMerges (integration)', () => {
  const db = hasTestDb ? getTestDb() : null!;

  async function seed() {
    await db.insert(users).values({ id: 'u1', username: 'mergetest', email: 'mt@test.com', passwordHash: 'x' });
    await db.insert(languages).values([
      { id: 'smb', code: 'smb', name: 'Sambas' },
      { id: 'idn', code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: 'n', code: 'n', name: 'Nomina' });
    await db.insert(words).values({
      id: 'w1',
      lemma: 'asin',
      languageId: 'smb',
      wordType: 'word',
      status: 'published',
      isVerified: true,
      isCorrected: false,
      createdBy: 'u1',
    });
    // Dua makna identik = satu kelompok.
    await db.insert(meanings).values([
      { id: 'm1', wordId: 'w1', wordClassId: 'n', definition: 'rasa garam', orderIndex: 1, status: 'published', isVerified: true, isCorrected: false, createdBy: 'u1', createdAt: new Date(1) },
      { id: 'm2', wordId: 'w1', wordClassId: 'n', definition: 'rasa garam', orderIndex: 2, status: 'published', isVerified: true, isCorrected: false, createdBy: 'u1', createdAt: new Date(2) },
    ]);
    await db.insert(examples).values({ id: 'e1', meaningId: 'm2', sourceLanguageId: 'smb', sourceSentence: 'airnya asin', createdBy: 'u1' });
    await db.insert(votes).values({ id: 'v1', userId: 'u1', entityType: 'meaning', entityId: 'm2', value: 1 });
    await db.insert(meaningVoteCounts).values({ meaningId: 'm2', total: 1 });
    await db.insert(meaningTranslations).values([
      { id: 't1', meaningId: 'm1', languageId: 'idn', translationText: 'salty' },
      { id: 't2', meaningId: 'm2', languageId: 'idn', translationText: 'salty' },
    ]);
  }

  it('menggabung kelompok dalam transaksi per kelompok dan idempoten saat rerun', async () => {
    await truncateAll(db);
    await seed();

    const first = await applySafeMeaningMerges(db);
    console.log('DBG first=', JSON.stringify(first));
    const allM = await db.select({ id: meanings.id, d: meanings.deletedAt, k: meanings.dedupeKey }).from(meanings);
    console.log('DBG meanings=', JSON.stringify(allM));
    expect(first.groups).toBe(1);

    // Pecundang soft-delete, contoh & vote pindah ke pemenang.
    const loser = (await db.select().from(meanings).where(eq(meanings.id, 'm2')))[0]!;
    expect(loser.deletedAt).not.toBeNull();
    const example = (await db.select().from(examples).where(eq(examples.id, 'e1')))[0]!;
    expect(example.meaningId).toBe('m1');
    const vote = (await db.select().from(votes).where(eq(votes.id, 'v1')))[0]!;
    expect(vote.entityId).toBe('m1');

    // Rerun: tidak ada kelompok baru, tidak error.
    const second = await applySafeMeaningMerges(db);
    expect(second.groups).toBe(0);
    const winner = (await db.select().from(meanings).where(eq(meanings.id, 'm1')))[0]!;
    expect(winner.deletedAt).toBeNull();
  });
});
