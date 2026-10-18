import { ServiceUnavailableError, UnauthorizedError } from '@/shared/errors/app-error';
import type { GithubOauthCodeExchangerPort } from '../application/ports/github-oauth-code-exchanger.port';

export class GithubOauthCodeExchanger implements GithubOauthCodeExchangerPort {
  constructor(
    private readonly clientId: string | undefined,
    private readonly clientSecret: string | undefined,
  ) {}

  async exchange(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<string> {
    const clientId = this.clientId?.trim();
    const clientSecret = this.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableError(
        'GITHUB_AUTH_UNAVAILABLE',
        'Masuk dengan GitHub sedang tidak tersedia.',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    });
    if (input.codeVerifier?.trim()) {
      body.set('code_verifier', input.codeVerifier.trim());
    }

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      throw new UnauthorizedError('INVALID_GITHUB_TOKEN', 'Tidak bisa masuk dengan GitHub.');
    }

    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!data.access_token?.trim()) {
      // GitHub sering 200 + { error } (bukan HTTP 4xx).
      console.error('[github.oauth] exchange gagal', {
        error: data.error,
        error_description: data.error_description,
        redirectUri: input.redirectUri,
        hasVerifier: Boolean(input.codeVerifier?.trim()),
        clientIdPrefix: clientId.slice(0, 8),
      });
      const message = messageForGithubOauthError(data.error);
      throw new UnauthorizedError('INVALID_GITHUB_TOKEN', message, [
        {
          field: 'github',
          message: data.error_description || data.error || 'unknown',
        },
      ]);
    }

    return data.access_token.trim();
  }
}

function messageForGithubOauthError(error: string | undefined): string {
  switch (error) {
    case 'bad_verification_code':
      return 'Kode GitHub sudah dipakai atau kadaluarsa. Coba masuk lagi.';
    case 'incorrect_client_credentials':
      return 'Konfigurasi GitHub di server salah. Hubungi pengelola.';
    case 'mismatching_redirect_uri':
      return 'Redirect GitHub tidak cocok. Coba update app lalu masuk lagi.';
    default:
      return 'Tidak bisa masuk dengan GitHub.';
  }
}
