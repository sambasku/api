import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import { SetAdminWordOfDayUseCase } from '../../application/use-cases/admin-word-of-day.use-cases';
import type { GetWordOfDayUseCase } from '../../application/use-cases/get-word-of-day.use-case';

describe('SetAdminWordOfDayUseCase', () => {
  it('menolak kata non-published', async () => {
    const wordRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'A'.repeat(26), lemma: 'x', status: 'draft' }),
    };
    const settingsRepo = { upsertMany: vi.fn() };
    const getWordOfDay = { invalidateCache: vi.fn() } as unknown as GetWordOfDayUseCase;
    const uc = new SetAdminWordOfDayUseCase(
      wordRepo as never,
      settingsRepo as never,
      getWordOfDay,
    );
    await expect(
      uc.execute({ date: '2026-09-21', wordId: 'A'.repeat(26), actorId: 'u1' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(settingsRepo.upsertMany).not.toHaveBeenCalled();
  });
});