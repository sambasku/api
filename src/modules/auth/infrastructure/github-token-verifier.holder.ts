import { env } from '@/shared/config/env';
import type { GithubTokenVerifierPort } from '../application/ports/github-token-verifier.port';
import { GithubTokenVerifier } from './github-token-verifier';

/** Seam e2e: ganti `current` dengan mock setelah app di-import. Jangan hit GitHub. */
export const githubTokenVerifierHolder: { current: GithubTokenVerifierPort } = {
  current: new GithubTokenVerifier(Boolean(env.GITHUB_CLIENT_ID?.trim())),
};

export const githubTokenVerifier: GithubTokenVerifierPort = {
  verify: (accessToken) => githubTokenVerifierHolder.current.verify(accessToken),
};
