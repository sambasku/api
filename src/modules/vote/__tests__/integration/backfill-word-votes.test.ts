import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { eq, inArray } from 'drizzle-orm';
import { getTestDb, getTestClient } from '@/shared/database/drizzle/test-client';
import {
  languages,
  meanings,
  meaningVoteCounts,
  users,
  votes,
  words,
} from '@/shared/database/drizzle/schema';
import { truncateAll } from '@/shared/database/drizzle/test-utils';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

/**
 * 0105 backfill: vote level kata -> vote makna, hanya kata dengan tepat 1
 * makna published. File migrasi dieksekusi apa adanya (idempoten) supaya
 * SQL-nya ikut teruji, bukan cuma niatnya.
 */
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'src/shared/database/drizzle/migrations/0105_backfill_word_votes_to_meanings.sql',
  ),
  'utf8',
);

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const LANG = ulid26('01TESTLANGBF');
const USER_A = ulid26('01TESTBFUSERA');
const USER_B = ulid26('01TESTBFUSERB');
const WORD_ONE = ulid26('01TESTBFWORD1');
const WORD_MANY = ulid26('01TESTBFWORD2');
const MEANING_ONE = ulid26('01TESTBFMEAN1');
const MEANING_MANY_A = ulid26('01TESTBFMEAN2');
const MEANING_MANY_B = ulid26('01TESTBFMEAN3');

async function applyBackfill(): Promise<void> {
  const client = getTestClient();
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) await client.execute(stmt);
}

describe.skipIf(!hasTestDb)('0105 backfill vote kata -> makna', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(languages).values({ id: LANG, code: 'smb', name: 'Sambas' });
    await db.insert(users).values([
      { id: USER_A, email: 'bfa@test.com', username: 'bfa' },
      { id: USER_B, email: 'bfb@test.com', username: 'bfb' },
    ]);
    await db.insert(words).values([
      { id: WORD_ONE, languageId: LANG, lemma: 'satu', status: 'published' },
      { id: WORD_MANY, languageId: LANG, lemma: 'dua', status: 'published' },
    ]);
    await db.insert(meanings).values([
      { id: MEANING_ONE, wordId: WORD_ONE, definition: 'def 1', status: 'published' },
      { id: MEANING_MANY_A, wordId: WORD_MANY, definition: 'def a', status: 'published' },
      { id: MEANING_MANY_B, wordId: WORD_MANY, definition: 'def b', status: 'published' },
    ]);
  });

  it('kata 1 makna dipindah ke makna, kata multi-makna dibiarkan', async () => {
    await db.insert(votes).values([
      { id: ulid26('01TESTBFVOTE1'), userId: USER_A, entityType: 'word', entityId: WORD_ONE, value: 1 },
      { id: ulid26('01TESTBFVOTE2'), userId: USER_B, entityType: 'word', entityId: WORD_ONE, value: -1 },
      { id: ulid26('01TESTBFVOTE3'), userId: USER_A, entityType: 'word', entityId: WORD_MANY, value: 1 },
    ]);

    await applyBackfill();

    const rows = await db
      .select()
      .from(votes)
      .where(inArray(votes.userId, [USER_A, USER_B]));

    const meaningVotes = rows.filter((r) => r.entityType === 'meaning');
    expect(meaningVotes).toHaveLength(2);
    expect(meaningVotes.every((r) => r.entityId === MEANING_ONE)).toBe(true);
    expect(meaningVotes.map((r) => r.value).sort()).toEqual([-1, 1]);
    // ID baru harus 26 char (kontrak ID opaque) dan unik
    expect(new Set(meaningVotes.map((r) => r.id)).size).toBe(2);
    expect(meaningVotes.every((r) => r.id.length === 26)).toBe(true);
    // created_at dipertahankan supaya riwayat tidak "baru"
    expect(meaningVotes.every((r) => r.createdAt !== null)).toBe(true);

    // Vote kata pada kata multi-makna TIDAK hilang, tidak dipindah
    const legacy = rows.filter((r) => r.entityType === 'word');
    expect(legacy).toHaveLength(1);
    expect(legacy[0].entityId).toBe(WORD_MANY);

    const counts = await db.select().from(meaningVoteCounts);
    expect(counts).toEqual([
      expect.objectContaining({ meaningId: MEANING_ONE, total: 2 }),
    ]);
  });

  it('vote makna yang sudah ada tidak diduplikasi', async () => {
    await db.insert(votes).values([
      { id: ulid26('01TESTBFVDUP1'), userId: USER_A, entityType: 'word', entityId: WORD_ONE, value: 1 },
      { id: ulid26('01TESTBFVDUP2'), userId: USER_A, entityType: 'meaning', entityId: MEANING_ONE, value: -1 },
    ]);

    await applyBackfill();

    const rows = await db.select().from(votes).where(eq(votes.userId, USER_A));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entityType: 'meaning', entityId: MEANING_ONE, value: -1 });

    const counts = await db.select().from(meaningVoteCounts);
    expect(counts).toEqual([
      expect.objectContaining({ meaningId: MEANING_ONE, total: 1 }),
    ]);
  });

  it('idempoten: dijalankan dua kali hasilnya sama', async () => {
    await db.insert(votes).values([
      { id: ulid26('01TESTBFVIDE1'), userId: USER_A, entityType: 'word', entityId: WORD_ONE, value: 1 },
    ]);

    await applyBackfill();
    const first = await db.select().from(votes);
    await applyBackfill();
    const second = await db.select().from(votes);

    expect(second.map((r) => r.id).sort()).toEqual(first.map((r) => r.id).sort());
  });
});
