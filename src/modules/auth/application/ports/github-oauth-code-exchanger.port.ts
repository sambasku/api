export interface GithubOauthCodeExchangerPort {
  /**
   * Tukar authorization code GitHub → access_token.
   * Secret hanya di server; mobile mengirim code (+ code_verifier PKCE).
   */
  exchange(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<string>;
}
