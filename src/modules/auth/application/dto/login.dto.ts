export interface LoginDto {
  /** Email ATAU username. Klien mobile kirim 'identifier', console/web 'email'. */
  identifier: string;
  password: string;
}

/** Metadata perangkat untuk record refresh_token */
export interface LoginMeta {
  deviceInfo?: string | null;
  ipAddress?: string | null;
  /** api_clients.client_id - diisi setelah ResolveFirstPartyClient */
  clientId?: string | null;
  /** Space-separated scopes untuk claim JWT */
  scopes?: string | null;
}
