import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

/**
 * Subquery vot loadStats: upvote dari user lain dihitung untuk word, meaning,
 * dan comment milik owner. Self-vote, meaning terhapus, dan downvote tidak.
 */
describe.skipIf(!hasTestDb)('loadStats vote_received branches e2e', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  const OWNER = 'u_lsvb1';
  const VOTER = 'u_lsvb2';
  const DOWNVOTER = 'u_lsvb3';
  const LANG = ulid26('01E2ELANGLSVB');
  const WORD = ulid26('01E2EWORDLSVB');
  const MEANING = ulid26('01E2EMEANLSVB');
  const MEANING_DELETED = ulid26('01E2EMEANDELVB');
  const COMMENT = ulid26('01E2ECOMMLSVB');

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    db = getTestDb();

    await truncateAll(db);
    await db.insert(schema.users).values([
      {
        id: OWNER,
        username: 'lsvbowner',
        displayName: 'LSVB Owner',
        email: 'lsvbowner@test.com',
        passwordHash: 'bukan-hash-login',
      },
      {
        id: VOTER,
        username: 'lsvbvoter',
        displayName: 'LSVB Voter',
        email: 'lsvbvoter@test.com',
        passwordHash: 'bukan-hash-login',
      },
      {
        id: DOWNVOTER,
        username: 'lsvbdown',
        displayName: 'LSVB Downvoter',
        email: 'lsvbdown@test.com',
        passwordHash: 'bukan-hash-login',
      },
    ]);
    await db.insert(schema.languages).values({ id: LANG, code: 'sbv', name: 'Sambas Vote' });
    await db.insert(schema.words).values({
      id: WORD,
      lemma: 'votekata',
      languageId: LANG,
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(),
      createdBy: OWNER,
      wordType: 'word',
    });
    await db.insert(schema.meanings).values([
      { id: MEANING, wordId: WORD, definition: 'makna tayang', createdBy: OWNER },
      {
        id: MEANING_DELETED,
        wordId: WORD,
        definition: 'makna dihapus',
        createdBy: OWNER,
        deletedAt: new Date(),
      },
    ]);
    await db.insert(schema.comments).values({
      id: COMMENT,
      wordId: WORD,
      userId: OWNER,
      body: 'komentar owner',
    });
    await db.insert(schema.votes).values([
      { id: ulid26('01LSVBV1'), userId: VOTER, entityType: 'word', entityId: WORD, value: 1 },
      { id: ulid26('01LSVBV2'), userId: VOTER, entityType: 'meaning', entityId: MEANING, value: 1 },
      { id: ulid26('01LSVBV3'), userId: VOTER, entityType: 'comment', entityId: COMMENT, value: 1 },
      // Tidak dihitung: self-vote, meaning terhapus, downvote
      { id: ulid26('01LSVBV4'), userId: OWNER, entityType: 'meaning', entityId: MEANING, value: 1 },
      {
        id: ulid26('01LSVBV5'),
        userId: VOTER,
        entityType: 'meaning',
        entityId: MEANING_DELETED,
        value: 1,
      },
      { id: ulid26('01LSVBV6'), userId: DOWNVOTER, entityType: 'word', entityId: WORD, value: -1 },
    ]);
  });

  it('hitung upvote word + meaning + comment, abaikan self-vote, terhapus, downvote', async () => {
    const { PublicUserRepositoryImpl } = await import(
      '@/modules/user/infrastructure/public-user.repository.impl'
    );
    const { POINT_WEIGHTS } = await import('@/modules/leveling/domain/leveling');
    const repo = new PublicUserRepositoryImpl(db);
    const stats = await repo.loadStats(OWNER);
    // Hanya 3 upvote valid, masing-masing bernilai vote_received
    expect(stats.leveling.points).toBe(3 * POINT_WEIGHTS.vote_received);
  });
});
