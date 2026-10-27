import { describe, it, expect, vi } from 'vitest';
import { DeletePantunUseCase } from '../../application/use-cases/delete-pantun.use-case';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { Pantun } from '../../domain/entities/pantun.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

const AUTHOR = '01JDAUTHOR0000000000000001';
const OTHER = '01JDOTHER00000000000000001';
const PANTUN_ID = '01JDPANTUN0000000000000001';

function makePantun(overrides: Partial<Pantun> = {}): Pantun {
  return {
    id: PANTUN_ID,
    userId: AUTHOR,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    categoryId: null,
    language: 'id',
    rhymeScheme: 'ABAB',
    lines: ['satu', 'dua', 'tiga', 'empat'],
    status: 'published',
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<PantunRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(makePantun()),
    markDeletedByAuthor: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as PantunRepository;
}

const audit = {
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
} as unknown as AuditLogRepository;

describe('DeletePantunUseCase', () => {
  it('penulis menghapus pantun sendiri → soft delete + audit', async () => {
    const repo = makeRepo();
    await new DeletePantunUseCase(repo, audit).execute({
      id: PANTUN_ID,
      actorId: AUTHOR,
    });

    expect(repo.markDeletedByAuthor).toHaveBeenCalledWith(PANTUN_ID, AUTHOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        entityType: 'pantun',
        newData: { status: 'deleted_by_author' },
      }),
    );
  });

  it('bukan penulis → ForbiddenError, tidak menyentuh repo', async () => {
    const repo = makeRepo();
    await expect(
      new DeletePantunUseCase(repo, audit).execute({
        id: PANTUN_ID,
        actorId: OTHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.markDeletedByAuthor).not.toHaveBeenCalled();
  });

  it('pantun tidak ada / sudah tidak tayang → NotFoundError', async () => {
    const uc = new DeletePantunUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(null) }),
      audit,
    );
    await expect(
      uc.execute({ id: PANTUN_ID, actorId: AUTHOR }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const deleted = new DeletePantunUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makePantun({ status: 'deleted_by_author' })),
      }),
      audit,
    );
    await expect(
      deleted.execute({ id: PANTUN_ID, actorId: AUTHOR }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
