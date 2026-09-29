import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import {
  BadGatewayError,
  ConflictError,
  ServiceUnavailableError,
} from '@/shared/errors/app-error';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/logging/logger';
import { parseGithubRepoUrl } from '@/modules/word/application/utils/github-repo-url';
import type { GithubActionsDispatchPort } from '../ports/github-actions-dispatch.port';
import type { DatabaseBackupLogRepository } from '../../domain/repositories/database-backup-log.repository';

const WORKFLOW_FILE = 'backup-release.yml';
const REF = 'main';
const DEFAULT_SQLITE_REPO_URL = 'https://github.com/sambasku/sqlite';

/** Baris aktif lebih tua dari ini dianggap workflow tidak pernah melapor balik. */
export const BACKUP_STALE_MS = 30 * 60 * 1000;
export const BACKUP_STALE_MESSAGE = 'Timeout - workflow tidak melapor';

export interface TriggerSqliteBackupInput {
  dryRun: boolean;
  actorUserId: string;
  triggerSource?: 'console' | 'manual';
}

export interface TriggerSqliteBackupResult {
  accepted: true;
  log_id: string;
  status: 'processing';
  dry_run: boolean;
}

/**
 * Token trigger = token asset yang sudah ada (image, fallback audio).
 * Bukan secret terpisah SQLITE_BACKUP_GITHUB_TOKEN.
 */
function resolveGithubToken(): string | undefined {
  return env.PUBLIC_IMAGE_GITHUB_TOKEN || env.PRONUNCIACION_GITHUB_TOKEN || undefined;
}

/**
 * Insert log `pending` -> dispatch workflow (bawa log_id) -> `processing`.
 * CI sqlite meng-UPDATE baris yang sama ke succeeded/failed saat selesai.
 */
export class TriggerSqliteBackupUseCase {
  constructor(
    private readonly dispatch: GithubActionsDispatchPort,
    private readonly users: UserRepository,
    private readonly logs: DatabaseBackupLogRepository,
  ) {}

  async execute(input: TriggerSqliteBackupInput): Promise<TriggerSqliteBackupResult> {
    const token = resolveGithubToken();
    const url = env.SQLITE_BACKUP_GITHUB_URL ?? DEFAULT_SQLITE_REPO_URL;
    if (!token) {
      throw new ServiceUnavailableError(
        'SQLITE_BACKUP_UNAVAILABLE',
        'Backup DB belum dikonfigurasi - butuh PUBLIC_IMAGE_GITHUB_TOKEN atau PRONUNCIACION_GITHUB_TOKEN',
      );
    }

    let owner: string;
    let repo: string;
    try {
      ({ owner, repo } = parseGithubRepoUrl(url, 'SQLITE_BACKUP_GITHUB_URL'));
    } catch {
      throw new ServiceUnavailableError(
        'SQLITE_BACKUP_UNAVAILABLE',
        'SQLITE_BACKUP_GITHUB_URL tidak valid',
      );
    }

    await this.logs.failStale(new Date(Date.now() - BACKUP_STALE_MS), BACKUP_STALE_MESSAGE);
    if (await this.logs.findActive()) {
      throw new ConflictError(
        'SQLITE_BACKUP_IN_PROGRESS',
        'Backup lain masih berjalan - tunggu sampai selesai',
      );
    }

    const user = await this.users.findById(input.actorUserId);
    const username = user?.username ?? null;
    const triggerSource = input.triggerSource ?? 'console';

    const log = await this.logs.create({
      triggeredByUserId: input.actorUserId,
      triggeredByUsername: username,
      triggerSource,
      dryRun: input.dryRun,
      status: 'pending',
      timeStart: new Date(),
    });

    try {
      await this.dispatch.workflowDispatch({
        owner,
        repo,
        workflowId: WORKFLOW_FILE,
        ref: REF,
        inputs: {
          dry_run: input.dryRun ? 'true' : 'false',
          triggered_by_user_id: input.actorUserId,
          triggered_by_username: username ?? '',
          trigger_source: triggerSource,
          log_id: log.id,
        },
        token,
      });
    } catch (err) {
      const upstream =
        err instanceof BadGatewayError || err instanceof ServiceUnavailableError
          ? err
          : new BadGatewayError('SQLITE_BACKUP_UPSTREAM', 'Gagal memicu workflow backup di GitHub');
      logger.error({ err, logId: log.id }, 'Dispatch backup DB gagal');
      await this.logs.updateStatus(log.id, 'failed', upstream.message);
      throw upstream;
    }

    await this.logs.updateStatus(log.id, 'processing');

    return {
      accepted: true,
      log_id: log.id,
      status: 'processing',
      dry_run: input.dryRun,
    };
  }
}
