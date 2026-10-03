export interface AccessTokenPayload {
  user_id: string; // ULID
  /** Semua role user. Sumber kebenaran otorisasi (multi role). */
  roles: string[];
  /** @deprecated Derived tertinggi dari roles (wire compat, baca `roles`). */
  role: string;
  // Klaim identitas tambahan (opsional, backward-compatible): dipakai admin
  // saat restore sesi (decode JWT) untuk menampilkan nama user tanpa
  // bergantung cache sessionStorage (yang per-tab).
  username?: string;
  /** Authorized party = api_clients.client_id */
  azp?: string;
  /** Space-separated OAuth scopes */
  scope?: string;
}

export interface TokenServicePort {
  generateAccessToken(payload: AccessTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}
