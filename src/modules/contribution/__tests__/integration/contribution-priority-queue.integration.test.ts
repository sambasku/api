import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { ValidationError } from '@/shared/errors/app-error';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('ContributionRepositoryImpl priority queue (#371)', () => {
  const langId = '01CPQ_LANG0000000000000001';
  const userId = '01CPQ_USER0000000000000001';
  const voterId = '01CPQ_USER0000000000000002';

  beforeEach(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    await db.insert(schema.languages).values({
      id: langId,
      code: 'sbb',
      name: 'Sambas',
    });
    await db.insert(schema.users).values([
      {
        id: userId,
        username: 'cpq_proposer',
        displayName: 'Proposer',
        email: 'cpq1@test.com',
        passwordHash: 'hash',
      },
      {
        id: voterId,
        username: 'cpq_voter',
        displayName: 'Voter',
        email: 'cpq2@test.com',
        passwordHash: 'hash',
      },
    ]);

    const now = new Date('2026-11-27T08:00:00.000Z');
    // 4 kata published + belum verified, masing-masing 1 makna
    await db.insert(schema.words).values([
      { id: '01CPQ_WORD0000000000000001', lemma: 'kata_pos_tua', languageId: langId, status: 'published', isVerified: false, createdBy: userId, wordType: 'word' },
      { id: '01CPQ_WORD0000000000000002', lemma: 'kata_minus_tua', languageId: langId, status: 'published', isVerified: false, createdBy: userId, wordType: 'word' },
      { id: '01CPQ_WORD0000000000000003', lemma: 'kata_novote_tua', languageId: langId, status: 'published', isVerified: false, createdBy: userId, wordType: 'word' },
      { id: '01CPQ_WORD0000000000000004', lemma: 'kata_novote_baru', languageId: langId, status: 'published', isVerified: false, createdBy: userId, wordType: 'word' },
      { id: '01CPQ_WORD0000000000000005', lemma: 'kata_approved_old', languageId: langId, status: 'published', isVerified: true, createdBy: userId, wordType: 'word' },
      { id: '01CPQ_WORD0000000000000006', lemma: 'kata_approved_new', languageId: langId, status: 'published', isVerified: true, createdBy: userId, wordType: 'word' },
    ]);

    await db.insert(schema.meanings).values([
      { id: '01CPQ_MEAN0000000000000001', wordId: '01CPQ_WORD0000000000000001', definition: 'def 1', status: 'published', isVerified: false, orderIndex: 0 },
      { id: '01CPQ_MEAN0000000000000002', wordId: '01CPQ_WORD0000000000000002', definition: 'def 2', status: 'published', isVerified: false, orderIndex: 0 },
      { id: '01CPQ_MEAN0000000000000003', wordId: '01CPQ_WORD0000000000000003', definition: 'def 3', status: 'published', isVerified: false, orderIndex: 0 },
      { id: '01CPQ_MEAN0000000000000004', wordId: '01CPQ_WORD0000000000000004', definition: 'def 4', status: 'published', isVerified: false, orderIndex: 0 },
    ]);

    // ULID terurut: C1 (paling tua, vote +1), C2 (vote -1), C3 (0 vote, tua), C4 (0 vote, baru)
    await db.insert(schema.contributions).values([
      { id: '01CPQ_CONT0000000000000001', userId, entityType: 'word', entityId: '01CPQ_WORD0000000000000001', action: 'create', status: 'pending', createdAt: now },
      { id: '01CPQ_CONT0000000000000002', userId, entityType: 'word', entityId: '01CPQ_WORD0000000000000002', action: 'create', status: 'pending', createdAt: now },
      { id: '01CPQ_CONT0000000000000003', userId, entityType: 'word', entityId: '01CPQ_WORD0000000000000003', action: 'create', status: 'pending', createdAt: now },
      { id: '01CPQ_CONT0000000000000004', userId, entityType: 'word', entityId: '01CPQ_WORD0000000000000004', action: 'create', status: 'pending', createdAt: now },
      { id: '01CPQ_CONT0000000000000005', userId, entityType: 'word', entityId: '01CPQ_WORD0000000000000005', action: 'create', status: 'approved', createdAt: now },
      { id: '01CPQ_CONT0000000000000006', userId, entityType: 'word', entityId: '01CPQ_WORD0000000000000006', action: 'create', status: 'approved', createdAt: now },
    ]);

    await db.insert(schema.votes).values([
      { id: '01CPQ_VOTE0000000000000001', userId: voterId, entityType: 'meaning', entityId: '01CPQ_MEAN0000000000000001', value: 1, createdAt: now },
      { id: '01CPQ_VOTE0000000000000002', userId: voterId, entityType: 'meaning', entityId: '01CPQ_MEAN0000000000000002', value: -1, createdAt: now },
    ]);
  });

  it('mengurutkan pending queue: Tier 0 (0 vote, tertua) -> Tier 1 (vote minus) -> Tier 2 (vote positif) + cursor lintas tier', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { ContributionRepositoryImpl } = await import(
      '../../infrastructure/contribution.repository.impl'
    );
    const repo = new ContributionRepositoryImpl(getTestDb());

    const full = await repo.list({ status: 'pending', limit: 10 });
    expect(full.items.map((i) => i.id)).toEqual([
      '01CPQ_CONT0000000000000003', // Tier 0, tua
      '01CPQ_CONT0000000000000004', // Tier 0, baru
      '01CPQ_CONT0000000000000002', // Tier 1, vote minus
      '01CPQ_CONT0000000000000001', // Tier 2, vote positif
    ]);

    // Pagination 2 per halaman lintas tier tanpa duplikat / lompat
    const p1 = await repo.list({ status: 'pending', limit: 2 });
    expect(p1.items.map((i) => i.id)).toEqual([
      '01CPQ_CONT0000000000000003',
      '01CPQ_CONT0000000000000004',
    ]);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextCursor).toBeTruthy();

    const p2 = await repo.list({ status: 'pending', limit: 2, cursor: p1.nextCursor! });
    expect(p2.items.map((i) => i.id)).toEqual([
      '01CPQ_CONT0000000000000002',
      '01CPQ_CONT0000000000000001',
    ]);
    expect(p2.hasMore).toBe(false);
    expect(p2.nextCursor).toBeNull();
  });

  it('status non-pending tetap urut id DESC dan cursor rusak lempar ValidationError', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { ContributionRepositoryImpl } = await import(
      '../../infrastructure/contribution.repository.impl'
    );
    const repo = new ContributionRepositoryImpl(getTestDb());

    const approved = await repo.list({ status: 'approved', limit: 10 });
    expect(approved.items.map((i) => i.id)).toEqual([
      '01CPQ_CONT0000000000000006',
      '01CPQ_CONT0000000000000005',
    ]);

    await expect(
      repo.list({ status: 'pending', limit: 10, cursor: 'bukan-cursor-valid' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
