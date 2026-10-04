// Context variables Hono lintas modul (di-set middleware shared)
export interface AuthUser {
  user_id: string; // ULID
  /** Semua role dari token. Sumber kebenaran otorisasi. */
  roles: string[];
  /** @deprecated Derived tertinggi dari roles (wire compat). Baca `roles`. */
  role: string;
  /** Authorized party dari JWT - api_clients.client_id */
  azp?: string;
  /** Space-separated scopes dari JWT */
  scope?: string;
  /** Flag internal middleware OAuth: sesi lama dipetakan ke scope first-party. */
  legacyMapped?: boolean;
}

export interface AppVariables {
  requestId: string;
  user?: AuthUser;
}
