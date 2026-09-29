import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadGatewayError,
  ConflictError,
  ServiceUnavailableError,
} from '@/shared/errors/app-error';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { GithubActionsDispatchPort } from '../../application/ports/github-actions-dispatch.port';
import type { DatabaseBackupLogRepository } from '../../domain/repositories/database-backup-log.repository';
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
  const logs = {
    list: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    findActive: vi.fn(),
    failStale: vi.fn(),
  } as unknown as DatabaseBackupLogRepository;

  const makeUc = () => new TriggerSqliteBackupUseCase(dispatch, users, logs);

  beforeEach(() => {
    vi.clearAllMocks();
    envState.PUBLIC_IMAGE_GITHUB_TOKEN = 'ghp_image';
    envState.PRONUNCIACION_GITHUB_TOKEN = undefined;
    envState.SQLITE_BACKUP_GITHUB_URL = 'https://github.com/sambasku/sqlite';
    vi.mocked(users.findById).mockResolvedValue({
      id: '01USER',
      username: 'admin',
    } as never);
    vi.mocked(logs.findActive).mockResolvedValue(null);
    vi.mocked(logs.create).mockResolvedValue({ id: '01LOG' } as never);
    vi.mocked(dispatch.workflowDispatch).mockResolvedValue(undefined);
  });

  it('503 jika token image dan audio kosong', async () => {
    envState.PUBLIC_IMAGE_GITHUB_TOKEN = undefined;
    envState.PRONUNCIACION_GITHUB_TOKEN = undefined;
    await expect(
      makeUc().execute({ dryRun: false, actorUserId: '01USER' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(dispatch.workflowDispatch).not.toHaveBeenCalled();
    expect(logs.create).not.toHaveBeenCalled();
  });

  it('insert pending -> dispatch dengan log_id -> processing', async () => {
    const result = await makeUc().execute({ dryRun: true, actorUserId: '01USER' });
    expect(result).toEqual({
      accepted: true,
      log_id: '01LOG',
      status: 'processing',
      dry_run: true,
    });
    expect(logs.failStale).toHaveBeenCalled();
    expect(logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        dryRun: true,
        triggeredByUserId: '01USER',
        triggeredByUsername: 'admin',
        triggerSource: 'console',
      }),
    );
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
          log_id: '01LOG',
        }),
      }),
    );
    expect(logs.updateStatus).toHaveBeenCalledWith('01LOG', 'processing');
  });

  it('fallback ke PRONUNCIACION_GITHUB_TOKEN jika image kosong', async () => {
    envState.PUBLIC_IMAGE_GITHUB_TOKEN = undefined;
    envState.PRONUNCIACION_GITHUB_TOKEN = 'ghp_audio';
    await makeUc().execute({ dryRun: false, actorUserId: '01USER' });
    expect(dispatch.workflowDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'ghp_audio' }),
    );
  });

  it('502 jika dispatch melempar, log ditandai failed', async () => {
    vi.mocked(dispatch.workflowDispatch).mockRejectedValue(new Error('network'));
    await expect(
      makeUc().execute({ dryRun: false, actorUserId: '01USER' }),
    ).rejects.toBeInstanceOf(BadGatewayError);
    expect(logs.updateStatus).toHaveBeenCalledWith('01LOG', 'failed', expect.any(String));
    expect(logs.updateStatus).not.toHaveBeenCalledWith('01LOG', 'processing');
  });

  it('409 jika masih ada backup aktif, tanpa insert/dispatch', async () => {
    vi.mocked(logs.findActive).mockResolvedValue({ id: '01OLD', status: 'processing' } as never);
    await expect(
      makeUc().execute({ dryRun: false, actorUserId: '01USER' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(logs.create).not.toHaveBeenCalled();
    expect(dispatch.workflowDispatch).not.toHaveBeenCalled();
  });
});
