import type { SupabaseHealthCheckRepository } from '../../domain/repositories/supabase-health-check.repository';
import type { SupabaseHealthEnv } from '../../domain/repositories/supabase-health-check.repository';

export class ListSupabaseHealthChecksUseCase {
  constructor(private readonly repo: SupabaseHealthCheckRepository) {}

  async execute(input: { limit: number; cursor?: string; env?: SupabaseHealthEnv }) {
    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
      env: input.env,
    });
  }
}
