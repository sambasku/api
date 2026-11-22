import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { getTestDb } from '@/shared/database/drizzle/test-client';
import {
  contributionReviews,
  contributions,
  languages,
  leaderboardExcludedUsers,
  users,
  wordEditSuggestions,
  words,
} from '@/shared/database/drizzle/schema';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import { LeaderboardRepositoryImpl } from '../../infrastructure/leaderboard.repository.impl';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { windowForWeekId } from '../../domain/utils/iso-week';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01TESTLANGSMB');
const KONTRIBUTOR = ulid26('01TESTKONTRIB');
const VERIFIER = ulid26('01TESTVERIFI');
const ANONIM = ANONIM_USER_ID;
const WORD1 = ulid26('01TESTWORDAAA');
const WORD2 = ulid26('01TESTWORDBBB');

// Window minggu ISO stabil: 2026-W40 (Senin 28 Sep - 5 Okt 2026)
const { startedAt, endedAt } = windowForWeekId('2026-W40');

type TestDb = Awaited<ReturnType<typeof getTestDb>>;

async function insertUser(
  db: TestDb,
  id: string,
  username: string,
  opts?: { active?: boolean; deleted?: boolean },
) {
  await db.insert(users).values({
    id,
    username,
    email: `${username}@test.com`,
    passwordHash: 'x',
    isActive: opts?.active ?? true,
    deletedAt: opts?.deleted ? new Date() : null,
  });
}

async function insertContribution(
  db: TestDb,
  input: {
    id: string;
    userId: string;
    status: 'pending' | 'approved' | 'rejected' | 'corrected';
    createdAt: Date;
    deleted?: boolean;
  },
) {
  await db.insert(contributions).values({
    id: input.id,
    userId: input.userId,
    entityType: 'word',
    entityId: WORD1,
    action: 'create',
    status: input.status,
    createdAt: input.createdAt,
    deletedAt: input.deleted ? new Date() : null,
  });
}

async function insertReview(
  db: TestDb,
  input: {
    contributionId: string;
    reviewerId: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'corrected';
    createdAt: Date;
    deleted?: boolean;
  },
) {
  await db.insert(contributionReviews).values({
    contributionId: input.contributionId,
    reviewerId: input.reviewerId,
    status: input.status,
    createdAt: input.createdAt,
    deletedAt: input.deleted ? new Date() : null,
  });
}

async function insertEditSuggestion(
  db: TestDb,
  input: {
    id: string;
    userId: string;
    status: 'pending' | 'approved' | 'rejected' | 'corrected';
    createdAt: Date;
    reviewedAt?: Date | null;
    deleted?: boolean;
  },
) {
  await db.insert(wordEditSuggestions).values({
    id: input.id,
    userId: input.userId,
    wordId: WORD2,
    proposedChanges: { lemma: 'kete2' },
    reason: 'perbaikan',
    reasonCode: 'other',
    status: input.status,
    createdAt: input.createdAt,
    reviewedAt: input.reviewedAt ?? null,
    deletedAt: input.deleted ? new Date() : null,
  });
}

describe.skipIf(!hasTestDb)('LeaderboardRepositoryImpl.aggregateScores (5/3/2/2)', () => {
  const db = hasTestDb ? getTestDb() : null!;
  const repo = new LeaderboardRepositoryImpl(db);

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(languages).values({ id: SMB, code: 'smb', name: 'Sambas' });
    await db.insert(words).values([
      { id: WORD1, languageId: SMB, lemma: 'kete', status: 'published', isVerified: true },
      { id: WORD2, languageId: SMB, lemma: 'kete2', status: 'published', isVerified: true },
    ]);
    await insertUser(db, KONTRIBUTOR, 'kontributor');
    await insertUser(db, VERIFIER, 'verifikator');
    await insertUser(db, ANONIM, 'anonim');
  });

  it('usul create non-rejected = 5 poin; rejected = hangus', async () => {
    await insertContribution(db, { id: ulid26('01TCNTAPPRV1'), userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt });
    await insertContribution(db, { id: ulid26('01TCNTPEND1'), userId: KONTRIBUTOR, status: 'pending', createdAt: startedAt });
    await insertContribution(db, { id: ulid26('01TCNTREJ1'), userId: KONTRIBUTOR, status: 'rejected', createdAt: startedAt });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont).toBeDefined();
    expect(cont!.submittedPoints).toBe(10); // 2 non-rejected x 5
    expect(cont!.approvedPoints).toBe(0);
    expect(cont!.verificationPoints).toBe(0);
    expect(cont!.combined).toBe(10);
  });

  it('usul edit non-rejected = 3 poin; bonus approve edit +2 saat reviewed approved', async () => {
    await insertEditSuggestion(db, { id: ulid26('01TEDSAPPRV1'), userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt, reviewedAt: startedAt });
    await insertEditSuggestion(db, { id: ulid26('01TEDSREJ1'), userId: KONTRIBUTOR, status: 'rejected', createdAt: startedAt });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont).toBeDefined();
    expect(cont!.submittedPoints).toBe(3); // 1 edit non-rejected x 3
    expect(cont!.approvedPoints).toBe(2); // bonus approve edit
    expect(cont!.combined).toBe(5);
  });

  it('bonus approve create +2 ke pengusul, dedup reopen (2 review row = 1 kontribusi)', async () => {
    const c1 = ulid26('01TCNTAPPRV2');
    await insertContribution(db, { id: c1, userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt });
    await insertReview(db, { contributionId: c1, reviewerId: VERIFIER, status: 'approved', createdAt: startedAt });
    await insertReview(db, { contributionId: c1, reviewerId: VERIFIER, status: 'corrected', createdAt: startedAt });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont!.submittedPoints).toBe(5);
    expect(cont!.approvedPoints).toBe(2); // dedup per kontribusi
    const ver = entries.find((e) => e.userId === VERIFIER);
    expect(ver!.verificationPoints).toBe(2); // dedup per kontribusi
  });

  it('self-review = 0 poin verifikasi (bonus pengusul tetap)', async () => {
    const c1 = ulid26('01TCNTSELF1');
    await insertContribution(db, { id: c1, userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt });
    await insertReview(db, { contributionId: c1, reviewerId: KONTRIBUTOR, status: 'approved', createdAt: startedAt });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont!.submittedPoints).toBe(5);
    expect(cont!.approvedPoints).toBe(2);
    expect(cont!.verificationPoints).toBe(0);
    expect(cont!.combined).toBe(7);
  });

  it('review pending / deleted tidak beri poin', async () => {
    const c1 = ulid26('01TCNTPEND1');
    await insertContribution(db, { id: c1, userId: KONTRIBUTOR, status: 'pending', createdAt: startedAt });
    await insertReview(db, { contributionId: c1, reviewerId: VERIFIER, status: 'pending', createdAt: startedAt });
    const c2 = ulid26('01TCNTDEL1');
    await insertContribution(db, { id: c2, userId: KONTRIBUTOR, status: 'pending', createdAt: startedAt });
    await insertReview(db, { contributionId: c2, reviewerId: VERIFIER, status: 'approved', createdAt: startedAt, deleted: true });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    expect(entries.find((e) => e.userId === VERIFIER)).toBeUndefined();
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont!.submittedPoints).toBe(10);
    expect(cont!.approvedPoints).toBe(0); // review approved hanya row deleted
  });

  it('anonim (user sistem) tidak masuk leaderboard', async () => {
    await insertContribution(db, { id: ulid26('01TCNTANON1'), userId: ANONIM, status: 'approved', createdAt: startedAt });
    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    expect(entries.find((e) => e.userId === ANONIM)).toBeUndefined();
  });

  it('user nonaktif tidak masuk leaderboard', async () => {
    const inactive = ulid26('01TESTINACTIV');
    await insertUser(db, inactive, 'nonaktif', { active: false });
    await insertContribution(db, { id: ulid26('01TCNTINAC1'), userId: inactive, status: 'approved', createdAt: startedAt });
    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    expect(entries.find((e) => e.userId === inactive)).toBeUndefined();
  });

  it('kontribusi deleted tidak beri poin', async () => {
    await insertContribution(db, { id: ulid26('01TCNTDEL2'), userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt, deleted: true });
    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    expect(entries.find((e) => e.userId === KONTRIBUTOR)).toBeUndefined();
  });

  it('submit minggu lalu + approve minggu ini = poin terpisah per window', async () => {
    const lastWeek = new Date(startedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const c1 = ulid26('01TCNTXWEEK');
    await insertContribution(db, { id: c1, userId: KONTRIBUTOR, status: 'approved', createdAt: lastWeek });
    await insertReview(db, { contributionId: c1, reviewerId: VERIFIER, status: 'approved', createdAt: startedAt });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont!.submittedPoints).toBe(0); // submit minggu lalu
    expect(cont!.approvedPoints).toBe(2); // bonus approve minggu ini
    const ver = entries.find((e) => e.userId === VERIFIER);
    expect(ver!.verificationPoints).toBe(2);
  });

  it('aggregate all-time = gabungan semua window', async () => {
    const lastWeek = new Date(startedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const c1 = ulid26('01TCNTALLT1');
    const c2 = ulid26('01TCNTALLT2');
    await insertContribution(db, { id: c1, userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt });
    await insertContribution(db, { id: c2, userId: KONTRIBUTOR, status: 'approved', createdAt: lastWeek });
    await insertReview(db, { contributionId: c1, reviewerId: VERIFIER, status: 'approved', createdAt: startedAt });
    await insertReview(db, { contributionId: c2, reviewerId: VERIFIER, status: 'approved', createdAt: lastWeek });

    const entries = await repo.computeAllTime('combined', 20);
    const cont = entries.find((e) => e.userId === KONTRIBUTOR);
    expect(cont!.submittedPoints).toBe(10);
    expect(cont!.approvedPoints).toBe(4);
    const ver = entries.find((e) => e.userId === VERIFIER);
    expect(ver!.verificationPoints).toBe(4);
  });

  it('exclude manual (leaderboard_excluded_users) mengeluarkan user', async () => {
    await db.insert(leaderboardExcludedUsers).values({ userId: VERIFIER });
    const c1 = ulid26('01TCNTEXCL1');
    await insertContribution(db, { id: c1, userId: KONTRIBUTOR, status: 'approved', createdAt: startedAt });
    await insertReview(db, { contributionId: c1, reviewerId: VERIFIER, status: 'approved', createdAt: startedAt });

    const entries = await repo.computeScoresForWindow(startedAt, endedAt);
    expect(entries.find((e) => e.userId === VERIFIER)).toBeUndefined();
    expect(entries.find((e) => e.userId === KONTRIBUTOR)).toBeDefined();
  });

  it('saveUserWeekStats idempoten (upsert) + listUserWeekStats urut minggu terbaru', async () => {
    const row = {
      userId: KONTRIBUTOR,
      weekId: '2026-W40',
      submittedPoints: 15,
      approvedPoints: 6,
      verificationPoints: 4,
      combined: 25,
      xpAtWeekEnd: 1000,
    };
    await repo.saveUserWeekStats([row]);
    // Upsert dengan nilai baru untuk minggu sama
    await repo.saveUserWeekStats([{ ...row, combined: 30, xpAtWeekEnd: 1100 }]);

    const stats = await repo.listUserWeekStats(KONTRIBUTOR, 52);
    expect(stats).toHaveLength(1);
    expect(stats[0]!.weekId).toBe('2026-W40');
    expect(stats[0]!.combined).toBe(30); // nilai upsert terakhir
    expect(stats[0]!.xpAtWeekEnd).toBe(1100);

    // Minggu lain untuk user sama, urut terbaru dulu
    await repo.saveUserWeekStats([
      { ...row, weekId: '2026-W41', combined: 10, xpAtWeekEnd: 1110 },
    ]);
    const stats2 = await repo.listUserWeekStats(KONTRIBUTOR, 52);
    expect(stats2).toHaveLength(2);
    expect(stats2[0]!.weekId).toBe('2026-W41');
    expect(stats2[1]!.weekId).toBe('2026-W40');
  });
});
