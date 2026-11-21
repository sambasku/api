import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use case impor db langsung (cek usulan edit pending) → mock agar unit
// test tidak memuat env.ts / koneksi Turso.
const limit = vi.fn().mockResolvedValue([]);
vi.mock('@/shared/database/drizzle/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit }),
      }),
    }),
  },
}));

import { VerifyWordUseCase } from '../../application/use-cases/verify-word.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

function makeDeps(setVerifiedResult = true, isVerified = false, found = true, meaningsCount = 1) {
  const wordRepo = {
    saveWithRelations: vi.fn(),
    findDuplicate: vi.fn(),
    findById: vi.fn().mockResolvedValue(found ? { id: '01JDWORDMAKATN0000000000A', isVerified } : null),
    findDetailById: vi.fn(),
    search: vi.fn(),
    findMissingReferences: vi.fn(),
    listWordClasses: vi.fn(),
    setVerified: vi.fn().mockResolvedValue(setVerifiedResult),
    countPublishedMeanings: vi.fn().mockResolvedValue(meaningsCount),
    verifyAllPublishedMeanings: vi.fn().mockResolvedValue(meaningsCount),
  } as unknown as WordRepository;
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() };
  return { wordRepo, auditRepo, useCase: new VerifyWordUseCase(wordRepo, auditRepo as unknown as AuditLogRepository) };
}

describe('VerifyWordUseCase', () => {
  beforeEach(() => {
    limit.mockReset();
    limit.mockResolvedValue([]);
  });

  it('verify → setVerified(true) + audit action verify', async () => {
    const { useCase, wordRepo, auditRepo } = makeDeps();
    await useCase.execute({ wordId: '01JDWORDMAKATN0000000000A', verified: true, actorId: '01JDUSERADMIN00000000000000A', requestId: 'req-1' });

    expect(wordRepo.setVerified).toHaveBeenCalledWith(
      '01JDWORDMAKATN0000000000A',
      expect.objectContaining({ isVerified: true, verifiedBy: '01JDUSERADMIN00000000000000A' }),
    );
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verify', newData: { is_verified: true }, requestId: 'req-1' }),
    );
    expect(wordRepo.verifyAllPublishedMeanings).toHaveBeenCalledWith(
      '01JDWORDMAKATN0000000000A',
      '01JDUSERADMIN00000000000000A',
    );
  });

  it('kata tanpa makna published → WORD_NO_PUBLISHED_MEANINGS 409, tanpa setVerified', async () => {
    const { useCase, wordRepo, auditRepo } = makeDeps(true, false, true, 0);
    await expect(
      useCase.execute({ wordId: '01JDWORDMAKATN0000000000A', verified: true, actorId: '01JDUSERADMIN00000000000000A' }),
    ).rejects.toMatchObject({ errorCode: 'WORD_NO_PUBLISHED_MEANINGS', statusCode: 409 });
    expect(wordRepo.setVerified).not.toHaveBeenCalled();
    expect(wordRepo.verifyAllPublishedMeanings).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('unverify → audit action unverify', async () => {
    const { useCase, auditRepo } = makeDeps(true, true);
    await useCase.execute({ wordId: '01JDWORDMAKATN0000000000A', verified: false, actorId: '01JDUSERADMIN00000000000000A' });
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unverify', newData: { is_verified: false } }),
    );
  });

  it('kata tidak ditemukan → WORD_NOT_FOUND 404, tanpa audit', async () => {
    const { useCase, auditRepo, wordRepo } = makeDeps(false, false, false);
    await expect(
      useCase.execute({ wordId: '01JDWORDNGACAK00000000000X', verified: true, actorId: '01JDUSERADMIN00000000000000A' }),
    ).rejects.toMatchObject({ errorCode: 'WORD_NOT_FOUND', statusCode: 404 });
    expect(wordRepo.setVerified).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('sudah terverifikasi → WORD_ALREADY_VERIFIED 409, tanpa audit', async () => {
    const { useCase, auditRepo, wordRepo } = makeDeps(true, true);
    await expect(
      useCase.execute({ wordId: '01JDWORDMAKATN0000000000A', verified: true, actorId: '01JDUSERADMIN00000000000000A' }),
    ).rejects.toMatchObject({ errorCode: 'WORD_ALREADY_VERIFIED', statusCode: 409 });
    expect(wordRepo.setVerified).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('belum terverifikasi lalu unverify → WORD_ALREADY_UNVERIFIED 409, tanpa audit', async () => {
    const { useCase, auditRepo, wordRepo } = makeDeps(true, false);
    await expect(
      useCase.execute({ wordId: '01JDWORDMAKATN0000000000A', verified: false, actorId: '01JDUSERADMIN00000000000000A' }),
    ).rejects.toMatchObject({ errorCode: 'WORD_ALREADY_UNVERIFIED', statusCode: 409 });
    expect(wordRepo.setVerified).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('ada usulan edit pending → SUGGESTION_ALREADY_PENDING 409, tanpa setVerified/audit', async () => {
    limit.mockResolvedValue([{ id: '01JDSUGGESTION00000000000A' }]);
    const { useCase, auditRepo, wordRepo } = makeDeps();
    await expect(
      useCase.execute({ wordId: '01JDWORDMAKATN0000000000A', verified: true, actorId: '01JDUSERADMIN00000000000000A' }),
    ).rejects.toMatchObject({ errorCode: 'SUGGESTION_ALREADY_PENDING', statusCode: 409 });
    expect(wordRepo.setVerified).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });
});
