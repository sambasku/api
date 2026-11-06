import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { MailerPort } from '@/modules/auth/application/ports/mailer.port';
import type { User } from '@/modules/auth/domain/entities/user.entity';
import type { RefreshTokenRepository } from '@/modules/auth/domain/repositories/refresh-token.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import { ApproveVerifierApplicationUseCase } from '../../application/use-cases/approve-verifier-application.use-case';
import type { VerifierApplication } from '../../domain/entities/verifier-application.entity';
import type { VerifierApplicationRepository } from '../../domain/repositories/verifier-application.repository';

const APP_ID = '01APP00000000000000000000';
const USER_ID = '01USER0000000000000000000';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    username: 'siti',
    displayName: 'Siti',
    bio: null,
    regionId: null,
    villageId: null,
    email: 'siti@test.com',
    phone: null,
    passwordHash: null,
    roles: ['reviewer'],
    role: 'reviewer',
    isActive: true,
    canContribute: true,
    contributeMutedUntil: null,
    readContributionGuideAt: null,
    levelSeen: 1,
    notifyStreakReminder: true,
    notifyLevelUp: true,
    emailVerified: true,
    avatarUrl: null,
    avatarProvider: null,
    avatarProviderFileId: null,
    avatarSha: null,
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
    ...overrides,
    isTeam: overrides.isTeam ?? false,
    teamAs: overrides.teamAs ?? null,
    teamNote: overrides.teamNote ?? null,
  };
}

function makeUseCase(
  user: User | null,
  mailerRejects = false,
  wa?: { send: ReturnType<typeof vi.fn>; readSettings: ReturnType<typeof vi.fn> },
) {
  const appRepo = {
    approveAtomically: vi.fn().mockResolvedValue({
      id: APP_ID,
      userId: USER_ID,
      status: 'approved',
      phone: '628111111111',
    } as VerifierApplication),
  } as unknown as VerifierApplicationRepository;
  const refreshTokenRepo = {
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as RefreshTokenRepository;
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
  const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) } as unknown as NotifyUserUseCase;
  const inbox = {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordInboxNotificationUseCase;
  const userRepo = {
    findById: vi.fn().mockResolvedValue(user),
  } as unknown as UserRepository;
  const mailer = {
    sendVerifierApprovedEmail: mailerRejects
      ? vi.fn().mockRejectedValue(new Error('resend down'))
      : vi.fn().mockResolvedValue(undefined),
  } as unknown as MailerPort;

  return {
    mailer,
    inbox,
    notifyUser,
    useCase: new ApproveVerifierApplicationUseCase(
      appRepo,
      refreshTokenRepo,
      auditRepo,
      notifyUser,
      userRepo,
      mailer,
      inbox,
      wa ? ({ execute: wa.send } as never) : undefined,
      wa?.readSettings,
    ),
  };
}

const cmd = {
  applicationId: APP_ID,
  actorId: '01ADMIN000000000000000000',
  actorRoles: ['admin'],
};

describe('ApproveVerifierApplicationUseCase', () => {
  it('mengirim email selamat ke email dan nama tampilan user', async () => {
    const { useCase, mailer, inbox, notifyUser } = makeUseCase(makeUser());
    const result = await useCase.execute(cmd);
    expect(result).toEqual({ id: APP_ID, status: 'approved', role: 'reviewer' });
    expect(mailer.sendVerifierApprovedEmail).toHaveBeenCalledWith('siti@test.com', 'Siti');
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'verifier_application_approved',
        targetKind: 'verifier_application',
        targetId: APP_ID,
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        data: expect.objectContaining({
          type: 'verifier_application_approved',
          title: 'Selamat, kamu jadi verifikator',
          body: expect.any(String),
        }),
      }),
    );
  });

  it('memakai username bila nama tampilan kosong', async () => {
    const { useCase, mailer } = makeUseCase(makeUser({ displayName: '   ' }));
    await useCase.execute(cmd);
    expect(mailer.sendVerifierApprovedEmail).toHaveBeenCalledWith('siti@test.com', 'siti');
  });

  it('tetap menyetujui bila email gagal terkirim', async () => {
    const { useCase, mailer } = makeUseCase(makeUser(), true);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await useCase.execute(cmd);
    expect(result.status).toBe('approved');
    expect(mailer.sendVerifierApprovedEmail).toHaveBeenCalled();
    error.mockRestore();
  });

  it('kirim WA selamat bila pengaturan aktif, pakai nomor pengajuan dan tautan grup', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const readSettings = vi.fn().mockResolvedValue({
      enabled: true,
      ctaUrl: 'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t&utm_source=sambasku.com&utm_medium=referral',
    });
    const { useCase } = makeUseCase(makeUser(), false, { send, readSettings });
    const result = await useCase.execute(cmd);
    expect(result.status).toBe('approved');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'verifier_application_approved',
        phone: '628111111111',
        displayName: 'Siti',
        ctaUrl: 'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t&utm_source=sambasku.com&utm_medium=referral',
      }),
    );
  });

  it('tidak kirim WA bila pengaturan mati', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const readSettings = vi.fn().mockResolvedValue({ enabled: false, ctaUrl: '' });
    const { useCase } = makeUseCase(makeUser(), false, { send, readSettings });
    const result = await useCase.execute(cmd);
    expect(result.status).toBe('approved');
    expect(send).not.toHaveBeenCalled();
  });

  it('tetap menyetujui bila kirim WA melempar error', async () => {
    const send = vi.fn().mockRejectedValue(new Error('openwa down'));
    const readSettings = vi.fn().mockResolvedValue({
      enabled: true,
      ctaUrl: 'https://chat.whatsapp.com/abc',
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { useCase } = makeUseCase(makeUser(), false, { send, readSettings });
    const result = await useCase.execute(cmd);
    expect(result.status).toBe('approved');
    expect(send).toHaveBeenCalled();
    error.mockRestore();
  });

  it('menolak actor selain admin/root (403)', async () => {
    const { useCase } = makeUseCase(makeUser());
    await expect(
      useCase.execute({ ...cmd, actorRoles: ['reviewer'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
