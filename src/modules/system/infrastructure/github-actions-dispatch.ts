import { BadGatewayError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logging/logger';
import type {
  GithubActionsDispatchPort,
  WorkflowDispatchInput,
} from '../application/ports/github-actions-dispatch.port';

const API_VERSION = '2022-11-28';
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'SambasKu-API/system';

/** Dispatch GitHub Actions workflow_dispatch (hanya trigger, tanpa poll). */
export class GithubActionsDispatchService implements GithubActionsDispatchPort {
  async workflowDispatch(input: WorkflowDispatchInput): Promise<void> {
    const url =
      `https://api.github.com/repos/${input.owner}/${input.repo}` +
      `/actions/workflows/${encodeURIComponent(input.workflowId)}/dispatches`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${input.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: input.ref, inputs: input.inputs }),
      });
    } catch (err) {
      logger.error({ err, workflow: input.workflowId }, 'GitHub Actions dispatch network error');
      throw new BadGatewayError(
        'SQLITE_BACKUP_UPSTREAM',
        'Tidak bisa menghubungi GitHub Actions',
      );
    } finally {
      clearTimeout(timer);
    }

    // 204 No Content = sukses
    if (res.status === 204) return;

    const bodyText = await res.text().catch(() => '');
    logger.error(
      { status: res.status, body: bodyText.slice(0, 500), workflow: input.workflowId },
      'GitHub Actions dispatch gagal',
    );
    throw new BadGatewayError(
      'SQLITE_BACKUP_UPSTREAM',
      `GitHub Actions menolak dispatch (HTTP ${res.status})`,
    );
  }
}
