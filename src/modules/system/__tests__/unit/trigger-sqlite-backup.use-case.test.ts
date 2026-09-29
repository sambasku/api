import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayError, ServiceUnavailableError } from '@/shared/errors/app-error';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { GithubActionsDispatchPort } from '../../application/ports/github-actions-dispatch.port';
import { TriggerSqliteBackupUseCase } from '../../application/use-cases/trigger-sqlite-backup.use-case';

const envState = vi.hoisted(() => ({
  PUBLIC_IMAGE_GITHUB_TOKEN: undefined as string | undefined,
  PRONUNCIACION_GITHUB_TOKEN: undefined as string | undefined,
  SQLITE_BACKUP_GITHUB_URL: undefined as string | undefined,
}));

vi.mock('@/shared/config/env', () => ({
  env: envState,
}));

describe('TriggerSqliteBackupUseCase', () => {
  const dispatch: GithubActionsDispatchPort = {
    workflowDispatch: vi.fn(),
  };
  const users = {
    findById: vi.fn(),
  } as unknown as UserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    envState.PUBLIC_IMAGE_GITHUB_TOKEN = 'ghp_image';
    envState.PRONUNCIACION_GITHUB_TOKEN = undefined;
    envState.SQLITE_BACKUP_GITHUB_URL = 'https://github.com/sambasku/sqlite';
    vi.mocked(users.findById).mockResolvedValue({
      id: '01USER',
      username: 'admin',
    } as never);
  });

  it('503 jika token image dan audio kosong', async () => {
    envState.PUBLIC_IMAGE_GITHUB_TOKEN = undefined;
    envState.PRONUNCIACION_GITHUB_TOKEN = undefined;
    const uc = new TriggerSqliteBackupUseCase(dispatch, users);
    await expect(
      uc.execute({ dryRun: false, actorUserId: '01USER' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(dispatch.workflowDispatch).not.toHaveBeenCalled();
  });

  it('pakai PUBLIC_IMAGE_GITHUB_TOKEN untuk dispatch', async () => {
    const uc = new TriggerSqliteBackupUseCase(dispatch, users);
    const result = await uc.execute({ dryRun: true, actorUserId: '01USER' });
    expect(result.accepted).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(dispatch.workflowDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'sambasku',
        repo: 'sqlite',
        token: 'ghp_image',
        inputs: expect.objectContaining({
          dry_run: 'true',
          triggered_by_user_id: '01USER',
          triggered_by_username: 'admin',
          trigger_source: 'console',
        }),
      }),
    );
  });

  it('fallback ke PRONUNCIACION_GITHUB_TOKEN jika image kosong', async () => {
    envState.PUBLIC_IMAGE_GITHUB_TOKEN = undefined;
    envState.PRONUNCIACION_GITHUB_TOKEN = 'ghp_audio';
    const uc = new TriggerSqliteBackupUseCase(dispatch, users);
    await uc.execute({ dryRun: false, actorUserId: '01USER' });
    expect(dispatch.workflowDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'ghp_audio' }),
    );
  });

  it('502 jika dispatch melempar', async () => {
    vi.mocked(dispatch.workflowDispatch).mockRejectedValue(new Error('network'));
    const uc = new TriggerSqliteBackupUseCase(dispatch, users);
    await expect(
      uc.execute({ dryRun: false, actorUserId: '01USER' }),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });
});
