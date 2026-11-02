import { describe, expect, it, vi } from 'vitest';
import { NotifyWordOwnerMediaUseCase } from '../../application/use-cases/notify-word-owner-media.use-case';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';

const OWNER = '01OWNERULID000000000000000';
const ACTOR = '01ACTORULID000000000000000';
const WORD = '01WORDULID000000000000000';

const resolved = { wordId: WORD, lemma: 'makatn', ownerUserId: OWNER };

function makeDeps(
  row: { wordId: string; lemma: string; ownerUserId: string | null } | null = resolved,
) {
  const wordRepo = { findWordOwnerByChild: vi.fn().mockResolvedValue(row) };
  const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
  const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
  const userRepo = {
    findById: vi.fn().mockResolvedValue({ displayName: 'Bujang', username: 'bujang' }),
  };
  const pushCooldown = { maySend: vi.fn().mockResolvedValue(true), touchAfterSend: vi.fn() };
  return { wordRepo, inbox, notifyUser, userRepo, pushCooldown };
}

describe('NotifyWordOwnerMediaUseCase (#133)', () => {
  it('contoh tayang → inbox word_example + push ke pemilik kata', async () => {
    const deps = makeDeps();
    const useCase = new NotifyWordOwnerMediaUseCase(
      deps.wordRepo,
      deps.inbox as never,
      deps.notifyUser as never,
      deps.userRepo,
      deps.pushCooldown as never,
    );

    await useCase.execute({ entityType: 'example', entityId: '01EXAMPLULID0000000000000', actorId: ACTOR });

    expect(deps.inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        type: 'word_example',
        targetKind: 'word',
        targetId: WORD,
        actionKind: 'word',
        actionValue: WORD,
        refreshOnConflict: true,
        body: 'Bujang menambahkan contoh kalimat di "makatn".',
      }),
    );
    expect(deps.notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        data: expect.objectContaining({ type: 'word_example', target_id: WORD }),
      }),
    );
    expect(deps.pushCooldown.touchAfterSend).toHaveBeenCalledWith(OWNER);
  });

  it('audio tayang → inbox word_audio dengan copy rekaman', async () => {
    const deps = makeDeps();
    const useCase = new NotifyWordOwnerMediaUseCase(
      deps.wordRepo,
      deps.inbox as never,
      deps.notifyUser as never,
      deps.userRepo,
      deps.pushCooldown as never,
    );

    await useCase.execute({ entityType: 'word_audio', entityId: '01AUDIOULID00000000000000', actorId: ACTOR });

    expect(deps.inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'word_audio',
        body: 'Bujang merekam pelafalan "makatn".',
      }),
    );
  });

  it('media milik aktor sendiri → tidak ada notif', async () => {
    const deps = makeDeps({ ...resolved, ownerUserId: ACTOR });
    const useCase = new NotifyWordOwnerMediaUseCase(deps.wordRepo, deps.inbox as never, deps.notifyUser as never);

    await useCase.execute({ entityType: 'example', entityId: '01EXAMPLULID0000000000000', actorId: ACTOR });

    expect(deps.inbox.execute).not.toHaveBeenCalled();
    expect(deps.notifyUser.execute).not.toHaveBeenCalled();
  });

  it('owner user sistem (anonim/csv) atau null → skip', async () => {
    for (const ownerUserId of [ANONIM_USER_ID, CSV_IMPORTER_USER_ID, null]) {
      const deps = makeDeps({ ...resolved, ownerUserId });
      const useCase = new NotifyWordOwnerMediaUseCase(deps.wordRepo, deps.inbox as never, deps.notifyUser as never);
      await useCase.execute({ entityType: 'example', entityId: '01EXAMPLULID0000000000000', actorId: ACTOR });
      expect(deps.inbox.execute).not.toHaveBeenCalled();
    }
  });

  it('media/kata sudah dihapus (resolver null) → tidak ada notif', async () => {
    const deps = makeDeps(null);
    const useCase = new NotifyWordOwnerMediaUseCase(deps.wordRepo, deps.inbox as never, deps.notifyUser as never);

    await useCase.execute({ entityType: 'word_audio', entityId: '01AUDIOULID00000000000000', actorId: ACTOR });

    expect(deps.inbox.execute).not.toHaveBeenCalled();
  });

  it('cooldown aktif → inbox tetap, push tidak', async () => {
    const deps = makeDeps();
    deps.pushCooldown.maySend.mockResolvedValue(false);
    const useCase = new NotifyWordOwnerMediaUseCase(
      deps.wordRepo,
      deps.inbox as never,
      deps.notifyUser as never,
      deps.userRepo,
      deps.pushCooldown as never,
    );

    await useCase.execute({ entityType: 'example', entityId: '01EXAMPLULID0000000000000', actorId: ACTOR });

    expect(deps.inbox.execute).toHaveBeenCalledTimes(1);
    expect(deps.notifyUser.execute).not.toHaveBeenCalled();
    expect(deps.pushCooldown.touchAfterSend).not.toHaveBeenCalled();
  });

  it('gagal resolve/push tidak melempar (best-effort)', async () => {
    const deps = makeDeps();
    deps.wordRepo.findWordOwnerByChild.mockRejectedValue(new Error('db down'));
    const useCase = new NotifyWordOwnerMediaUseCase(deps.wordRepo, deps.inbox as never, deps.notifyUser as never);

    await expect(
      useCase.execute({ entityType: 'example', entityId: '01EXAMPLULID0000000000000', actorId: ACTOR }),
    ).resolves.toBeUndefined();
  });
});
