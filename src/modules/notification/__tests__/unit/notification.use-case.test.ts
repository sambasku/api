import { describe, it, expect, vi } from 'vitest';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { RecordInboxNotificationUseCase } from '../../application/use-cases/record-inbox-notification.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/mark-notification-read.use-case';
import type { NotificationRepository } from '../../domain/repositories/notification.repository';

function repo(overrides: Partial<NotificationRepository> = {}): NotificationRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createMany: vi.fn().mockResolvedValue(0),
    upsertUnread: vi.fn().mockResolvedValue(undefined),
    listByUser: vi.fn(),
    countUnread: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteByTarget: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('RecordInboxNotificationUseCase', () => {
  it('menulis inbox dengan copy type', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await useCase.execute({
      userId: '01CONTRIBUTORULID0000000000',
      type: 'contribution_rejected',
      targetKind: 'contribution',
      targetId: '01CONTRIBULID0000000000000',
    });
    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '01CONTRIBUTORULID0000000000',
        type: 'contribution_rejected',
        title: 'Kata ditarik',
        targetKind: 'contribution',
        targetId: '01CONTRIBULID0000000000000',
      }),
    );
  });

  it('skip user anonim', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await useCase.execute({
      userId: ANONIM_USER_ID,
      type: 'contribution_approved',
      targetKind: 'contribution',
      targetId: '01CONTRIBULID0000000000000',
    });
    expect(notificationRepo.create).not.toHaveBeenCalled();
  });

  it('skip pengimpor CSV', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await useCase.execute({
      userId: CSV_IMPORTER_USER_ID,
      type: 'word_comment',
      targetKind: 'word',
      targetId: '01WORDULID0000000000000000',
    });
    expect(notificationRepo.create).not.toHaveBeenCalled();
    expect(notificationRepo.upsertUnread).not.toHaveBeenCalled();
  });

  it('override title dan body; upsert unread', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await useCase.execute({
      userId: '01CONTRIBUTORULID0000000000',
      type: 'word_comment',
      targetKind: 'word',
      targetId: '01WORDULID0000000000000000',
      title: 'Komentar baru',
      body: 'John juga berkomentar di "rumah": Halo',
      refreshOnConflict: true,
    });
    expect(notificationRepo.create).not.toHaveBeenCalled();
    expect(notificationRepo.upsertUnread).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'word_comment',
        title: 'Komentar baru',
        body: 'John juga berkomentar di "rumah": Halo',
      }),
    );
  });

  it('skip jika actorId sama dengan penerima (self-notify)', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    const selfId = '01CONTRIBUTORULID0000000000';
    await useCase.execute({
      userId: selfId,
      actorId: selfId,
      type: 'contribution_approved',
      targetKind: 'contribution',
      targetId: '01CONTRIBULID0000000000000',
    });
    expect(notificationRepo.create).not.toHaveBeenCalled();
  });

  it('tetap tulis jika actor berbeda dari penerima', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await useCase.execute({
      userId: '01CONTRIBUTORULID0000000000',
      actorId: '01ADMINULID00000000000000',
      type: 'contribution_approved',
      targetKind: 'contribution',
      targetId: '01CONTRIBULID0000000000000',
    });
    expect(notificationRepo.create).toHaveBeenCalled();
  });

  it('gagal insert tidak throw', async () => {
    const notificationRepo = repo({
      create: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await expect(
      useCase.execute({
        userId: '01CONTRIBUTORULID0000000000',
        type: 'contribution_approved',
        targetKind: 'contribution',
        targetId: '01CONTRIBULID0000000000000',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('MarkNotificationReadUseCase', () => {
  it('not_found → NOTIFICATION_NOT_FOUND', async () => {
    const notificationRepo = repo({ markRead: vi.fn().mockResolvedValue('not_found') });
    const useCase = new MarkNotificationReadUseCase(notificationRepo);
    await expect(useCase.execute('01USER', '01NOTIF00000000000000000000')).rejects.toMatchObject({
      errorCode: 'NOTIFICATION_NOT_FOUND',
    });
  });

  it('already_read → alreadyRead true', async () => {
    const notificationRepo = repo({ markRead: vi.fn().mockResolvedValue('already_read') });
    const useCase = new MarkNotificationReadUseCase(notificationRepo);
    await expect(useCase.execute('01USER', '01NOTIF00000000000000000000')).resolves.toEqual({
      alreadyRead: true,
    });
  });
});

describe('RecordInboxNotificationUseCase.executeIfNew', () => {
  const cmd = {
    userId: '01AUTHORULID0000000000001',
    type: 'article_clap' as const,
    targetKind: 'article' as const,
    targetId: '01ARTICLE:01ACTOR',
    actorId: '01ACTORULID00000000000001',
  };

  it('true bila baris baru ter-insert', async () => {
    const notificationRepo = repo({ createMany: vi.fn().mockResolvedValue(1) });
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await expect(useCase.executeIfNew(cmd)).resolves.toBe(true);
    expect(notificationRepo.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: cmd.userId, targetId: cmd.targetId }),
    ]);
  });

  it('false bila baris sudah ada (conflict do nothing)', async () => {
    const notificationRepo = repo({ createMany: vi.fn().mockResolvedValue(0) });
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await expect(useCase.executeIfNew(cmd)).resolves.toBe(false);
  });

  it('false tanpa insert untuk self, anonim, importer', async () => {
    const notificationRepo = repo();
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    await expect(useCase.executeIfNew({ ...cmd, actorId: cmd.userId })).resolves.toBe(false);
    await expect(useCase.executeIfNew({ ...cmd, userId: ANONIM_USER_ID })).resolves.toBe(false);
    await expect(useCase.executeIfNew({ ...cmd, userId: CSV_IMPORTER_USER_ID })).resolves.toBe(false);
    expect(notificationRepo.createMany).not.toHaveBeenCalled();
  });

  it('false bila insert gagal (best-effort)', async () => {
    const notificationRepo = repo({ createMany: vi.fn().mockRejectedValue(new Error('boom')) });
    const useCase = new RecordInboxNotificationUseCase(notificationRepo);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(useCase.executeIfNew(cmd)).resolves.toBe(false);
    spy.mockRestore();
  });
});
