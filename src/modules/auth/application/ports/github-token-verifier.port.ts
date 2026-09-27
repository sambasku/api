export interface GithubUserClaims {
  /** Numeric GitHub user id as string */
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface GithubTokenVerifierPort {
  verify(accessToken: string): Promise<GithubUserClaims>;
}
