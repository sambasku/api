import { describe, expect, it, vi } from 'vitest';
import { SkipContributionUseCase } from '../../application/use-cases/skip-contribution.use-case';
import type { ContributionRepository } from '../../domain/repositories/contribution.repository';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';

const USER = '01ADMINULID00000000000000';
const ID = '01CONTRIBULID0000000000000';

function makeDeps(found = true) {
  const contributions = {
    findById: vi.fn().mockResolvedValue(found ? { id: ID } : null),
  } as unknown as ContributionRepository;
  const skips = {
    record: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserSkipRepository;
  return { contributions, skips, useCase: new SkipContributionUseCase(contributions, skips) };
}

describe('SkipContributionUseCase', () => {
  it('kontribusi ada → record skip, status tidak disentuh', async () => {
    const { useCase, skips, contributions } = makeDeps();
    await useCase.skip(USER, ID);
    expect(contributions.findById).toHaveBeenCalledWith(ID);
    expect(skips.record).toHaveBeenCalledWith(USER, 'contribution', ID);
  });

  it('tidak ada → 404', async () => {
    const { useCase, skips } = makeDeps(false);
    await expect(useCase.skip(USER, ID)).rejects.toMatchObject({
      errorCode: 'CONTRIBUTION_NOT_FOUND',
      statusCode: 404,
    });
    expect(skips.record).not.toHaveBeenCalled();
  });

  it('unskip pada id yang ada menghapus catatan', async () => {
    const { useCase, skips } = makeDeps();
    await useCase.unskip(USER, ID);
    expect(skips.clear).toHaveBeenCalledWith(USER, 'contribution', ID);
  });
});
