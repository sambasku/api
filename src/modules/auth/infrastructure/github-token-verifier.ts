import { ServiceUnavailableError, UnauthorizedError } from '@/shared/errors/app-error';
import type {
  GithubTokenVerifierPort,
  GithubUserClaims,
} from '../application/ports/github-token-verifier.port';

const INVALID = () =>
  new UnauthorizedError('INVALID_GITHUB_TOKEN', 'Tidak bisa masuk dengan GitHub.');

type GhUser = {
  id?: number;
  login?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type GhEmail = {
  email?: string;
  primary?: boolean;
  verified?: boolean;
};

export class GithubTokenVerifier implements GithubTokenVerifierPort {
  constructor(private readonly enabled: boolean) {}

  async verify(accessToken: string): Promise<GithubUserClaims> {
    if (!this.enabled) {
      throw new ServiceUnavailableError(
        'GITHUB_AUTH_UNAVAILABLE',
        'Masuk dengan GitHub sedang tidak tersedia.',
      );
    }

    const token = accessToken.trim();
    if (!token) throw INVALID();

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sambasku-api',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      const userRes = await fetch('https://api.github.com/user', { headers });
      if (!userRes.ok) throw INVALID();
      const user = (await userRes.json()) as GhUser;
      if (typeof user.id !== 'number' || !user.login) throw INVALID();

      let email: string | null =
        typeof user.email === 'string' && user.email.includes('@') ? user.email : null;

      if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
        if (emailsRes.ok) {
          const emails = (await emailsRes.json()) as GhEmail[];
          const primary =
            emails.find((e) => e.primary && e.verified && e.email) ??
            emails.find((e) => e.verified && e.email);
          if (primary?.email) email = primary.email;
        }
      }

      return {
        id: String(user.id),
        login: user.login,
        name: typeof user.name === 'string' ? user.name : null,
        email,
        avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : null,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableError) throw err;
      if (err instanceof UnauthorizedError && err.errorCode === 'INVALID_GITHUB_TOKEN') throw err;
      throw INVALID();
    }
  }
}
