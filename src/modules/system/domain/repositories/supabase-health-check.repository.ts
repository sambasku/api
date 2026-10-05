export type SupabaseHealthEnv = 'staging' | 'production';
export type SupabaseHealthStatus = 'ok' | 'failed';

export interface SupabaseHealthCheck {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  projectLabel: string;
  projectRef: string;
  env: SupabaseHealthEnv;
  httpStatus: number | null;
  status: SupabaseHealthStatus;
  timeStart: Date | null;
  timeEnd: Date | null;
  durationMs: number | null;
  githubRunId: string | null;
  githubRunUrl: string | null;
  errorMessage: string | null;
}

export interface SupabaseHealthCheckFilter {
  limit: number;
  cursor?: string;
  env?: SupabaseHealthEnv;
}

export interface SupabaseHealthCheckPage {
  items: SupabaseHealthCheck[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SupabaseHealthCheckRepository {
  list(filter: SupabaseHealthCheckFilter): Promise<SupabaseHealthCheckPage>;
  create(input: Omit<SupabaseHealthCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupabaseHealthCheck>;
}
