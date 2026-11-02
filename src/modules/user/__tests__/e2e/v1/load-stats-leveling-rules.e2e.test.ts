import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

/**
 * Path SQL loadStats: impor 50%, self-verify = 0 poin, vote_received +1.
 */
describe.skipIf(!hasTestDb)('loadStats leveling rules e2e', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  const OWNER = 'u_lsrule1';
  const OTHER = 'u_lsrule2';
  const LANG = ulid26('01E2ELANGLSR');
  const WORD_IMPORT = ulid26('01E2EWORDIMP');
  const WORD_OTHER = ulid26('01E2EWORDOTH');
  const CONTRIB_IMPORT = ulid26('01LSRCI');
  const CONTRIB_OTHER = ulid26('01LSRCO');
  const REVIEW_SELF = ulid26('01LSRVS');
  const REVIEW_OTHER = ulid26('01LSRVO');

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    db = getTestDb();
    await truncateAll(db);

    await db.insert(schema.users).values([
      {
        id: OWNER,
        username: 'lsowner',
        displayName: 'Owner',
        email: 'lsowner@test.com',
        passwordHash: 'x',
      },
      {
        id: OTHER,
        username: 'lsother',
        displayName: 'Other',
        email: 'lsother@test.com',
        passwordHash: 'x',
      },
    ]);
    await db.insert(schema.languages).values({
      id: LANG,
      code: 'sbb',
      name: 'Sambas',
    });
    const IMP_SESS = ulid26('01E2EIMPSESS');
    await db.insert(schema.wordImportSessions).values({
      id: IMP_SESS,
      triggeredBy: OWNER,
      attributedTo: OWNER,
      status: 'completed',
      total: 1,
      createdCount: 1,
    });
    await db.insert(schema.words).values([
      {
        id: WORD_IMPORT,
        lemma: 'imporan',
        languageId: LANG,
        status: 'published',
        isVerified: true,
        verifiedAt: new Date(),
        createdBy: OWNER,
        wordType: 'word',
        importSessionId: IMP_SESS,
      },
      {
        id: WORD_OTHER,
        lemma: 'oranglain',
        languageId: LANG,
        status: 'published',
        isVerified: true,
        verifiedAt: new Date(),
        createdBy: OTHER,
        wordType: 'word',
      },
    ]);
    await db.insert(schema.contributions).values([
      {
        id: CONTRIB_IMPORT,
        userId: OWNER,
        entityType: 'word',
        entityId: WORD_IMPORT,
        action: 'create',
        status: 'approved',
      },
      {
        id: CONTRIB_OTHER,
        userId: OTHER,
        entityType: 'word',
        entityId: WORD_OTHER,
        action: 'create',
        status: 'approved',
      },
    ]);
    // Self-verify karya sendiri + verifikasi karya orang lain
    await db.insert(schema.contributionReviews).values([
      {
        id: REVIEW_SELF,
        contributionId: CONTRIB_IMPORT,
        reviewerId: OWNER,
        status: 'approved',
      },
      {
        id: REVIEW_OTHER,
        contributionId: CONTRIB_OTHER,
        reviewerId: OWNER,
        status: 'approved',
      },
    ]);
    // Upvote diterima atas kata impor milik OWNER (bukan self-vote)
    await db.insert(schema.votes).values({
      id: ulid26('01LSRVOT'),
      userId: OTHER,
      entityType: 'word',
      entityId: WORD_IMPORT,
      value: 1,
    });
  });

  it('impor 50% + self-verify 0 + vote_received 1', async () => {
    const { PublicUserRepositoryImpl } = await import(
      '@/modules/user/infrastructure/public-user.repository.impl'
    );
    const {
      POINT_WEIGHTS,
      IMPORT_POINT_FACTOR,
      scarcityMultiplier,
    } = await import('@/modules/leveling/domain/leveling');
    const repo = new PublicUserRepositoryImpl(db);
    const stats = await repo.loadStats(OWNER);

    // 2 lemma di bahasa → kelangkaan rare (×1.5) setelah impor 50%.
    const expectedWord =
      POINT_WEIGHTS.word * IMPORT_POINT_FACTOR * scarcityMultiplier(2);
    const expectedVerify = POINT_WEIGHTS.verification; // hanya non-self
    const expectedVote = POINT_WEIGHTS.vote_received;
    const expected = Math.floor(expectedWord + expectedVerify + expectedVote);

    expect(stats.leveling.points).toBe(expected);
    expect(stats.leveling.accuracy).toBe(1); // non-self verify saja (0 koreksi)
    expect(stats.verificationsDone).toBe(2); // self + other di stats klasik
  });
});
