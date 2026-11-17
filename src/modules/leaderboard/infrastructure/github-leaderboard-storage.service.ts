import { env } from '@/shared/config/env';
import { BadGatewayError, ServiceUnavailableError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logging/logger';
import {
  bytesToBase64,
  buildJsDelivrPublicUrl,
  parseGithubRepoUrl,
} from '@/modules/word/application/utils/github-repo-url';
import type { LeaderboardFilePayload } from '../domain/entities/leaderboard-entry.entity';
import type {
  LeaderboardPublishResult,
  LeaderboardStoragePort,
} from '../application/ports/leaderboard-storage.port';

const BRANCH = 'main';
const API_VERSION = '2022-11-28';
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'SambasKu-API/leaderboard';

export class GitHubLeaderboardStorageService implements LeaderboardStoragePort {
  readonly currentPublicUrl: string;
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;

  constructor() {
    const token = env.LEADERBOARD_GITHUB_TOKEN;
    const url = env.LEADERBOARD_GITHUB_URL;
    if (!token || !url) {
      throw new ServiceUnavailableError(
        'LEADERBOARD_STORAGE_UNAVAILABLE',
        'Penyimpanan leaderboard belum dikonfigurasi - isi LEADERBOARD_GITHUB_* di env',
      );
    }
    const { owner, repo } = parseGithubRepoUrl(url, 'LEADERBOARD_GITHUB_URL');
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.currentPublicUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${BRANCH}/current.json`;
  }

  weeklyPublicUrl(weekId: string): string {
    return buildJsDelivrPublicUrl({
      owner: this.owner,
      repo: this.repo,
      branch: BRANCH,
      path: `weekly/${weekId}.json`,
    });
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit, attempt = 0): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status >= 500 && attempt < 1) {
        return this.fetchWithRetry(url, init, attempt + 1);
      }
      return res;
    } catch (err) {
      if (attempt < 1) return this.fetchWithRetry(url, init, attempt + 1);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async readSha(path: string): Promise<string | undefined> {
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${BRANCH}`;
    const res = await this.fetchWithRetry(apiUrl, { method: 'GET', headers: this.headers() });
    if (res.status === 404) return undefined;
    if (!res.ok) return undefined;
    const json = (await res.json()) as { sha?: string };
    return json.sha;
  }

  private async putJson(path: string, body: LeaderboardFilePayload, message: string): Promise<void> {
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    const content = new TextEncoder().encode(JSON.stringify(body, null, 2));
    const sha = await this.readSha(path);
    let res: Response;
    try {
      res = await this.fetchWithRetry(apiUrl, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          message,
          content: bytesToBase64(content),
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
    } catch (err) {
      logger.error({ err, path }, 'GitHub leaderboard publish network error');
      throw new BadGatewayError('LEADERBOARD_STORAGE_UNAVAILABLE', 'Gagal mempublikasikan leaderboard ke GitHub');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ status: res.status, body: text.slice(0, 400), path }, 'GitHub leaderboard publish ditolak');
      if (res.status === 401 || res.status === 403) {
        throw new ServiceUnavailableError(
          'LEADERBOARD_STORAGE_UNAVAILABLE',
          'Token penyimpanan leaderboard tidak valid atau tidak punya akses',
        );
      }
      throw new BadGatewayError('LEADERBOARD_STORAGE_UNAVAILABLE', 'Gagal mempublikasikan leaderboard ke GitHub');
    }
  }

  async publishCurrent(payload: LeaderboardFilePayload): Promise<LeaderboardPublishResult> {
    await this.putJson('current.json', payload, `leaderboard: refresh ${payload.week_id}`);
    return { url: this.currentPublicUrl };
  }

  async publishWeekly(weekId: string, payload: LeaderboardFilePayload): Promise<LeaderboardPublishResult> {
    const path = `weekly/${weekId}.json`;
    await this.putJson(path, payload, `leaderboard: finalize ${weekId}`);
    return { url: this.weeklyPublicUrl(weekId) };
  }
}