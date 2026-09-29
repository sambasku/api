import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import { BadGatewayError, ServiceUnavailableError } from '@/shared/errors/app-error';
import { env } from '@/shared/config/env';
import { parseGithubRepoUrl } from '@/modules/word/application/utils/github-repo-url';
import type { GithubActionsDispatchPort } from '../ports/github-actions-dispatch.port';

const WORKFLOW_FILE = 'backup-release.yml';
const REF = 'main';
const DEFAULT_SQLITE_REPO_URL = 'https://github.com/sambasku/sqlite';

export interface TriggerSqliteBackupInput {
  dryRun: boolean;
  actorUserId: string;
  triggerSource?: 'console' | 'manual';
}

export interface TriggerSqliteBackupResult {
  accepted: true;
  workflow: string;
  ref: string;
  dry_run: boolean;
  html_url: string;
}

/**
 * Token trigger = token asset yang sudah ada (image, fallback audio).
 * Bukan secret terpisah SQLITE_BACKUP_GITHUB_TOKEN.
 */
function resolveGithubToken(): string | undefined {
  return env.PUBLIC_IMAGE_GITHUB_TOKEN || env.PRONUNCIACION_GITHUB_TOKEN || undefined;
}

export class TriggerSqliteBackupUseCase {
  constructor(
    private readonly dispatch: GithubActionsDispatchPort,
    private readonly users: UserRepository,
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

    const user = await this.users.findById(input.actorUserId);
    const username = user?.username ?? null;
    const triggerSource = input.triggerSource ?? 'console';

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
        },
        token,
      });
    } catch (err) {
      if (err instanceof BadGatewayError || err instanceof ServiceUnavailableError) throw err;
      throw new BadGatewayError(
        'SQLITE_BACKUP_UPSTREAM',
        'Gagal memicu workflow backup di GitHub',
      );
    }

    return {
      accepted: true,
      workflow: WORKFLOW_FILE,
      ref: REF,
      dry_run: input.dryRun,
      html_url: `https://github.com/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}`,
    };
  }
}
