import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { TriggerSupabaseHealthCheckUseCase } from '../../application/use-cases/trigger-supabase-health-check.use-case';
import type { ListSupabaseHealthChecksUseCase } from '../../application/use-cases/list-supabase-health-checks.use-case';
import type { SupabaseHealthCheck } from '../../domain/repositories/supabase-health-check.repository';
import type {
  ListSupabaseHealthChecksQuery,
} from './validators/system-supabase.validator';

type AdminCtx = Context<{ Variables: AppVariables }>;

function toWire(row: SupabaseHealthCheck) {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    project_label: row.projectLabel,
    project_ref: row.projectRef,
    env: row.env,
    http_status: row.httpStatus,
    status: row.status,
    time_start: row.timeStart ? row.timeStart.toISOString() : null,
    time_end: row.timeEnd ? row.timeEnd.toISOString() : null,
    duration_ms: row.durationMs,
    github_run_id: row.githubRunId,
    github_run_url: row.githubRunUrl,
    error_message: row.errorMessage,
  };
}

export class SystemSupabaseController {
  constructor(
    private readonly deps: {
      list: ListSupabaseHealthChecksUseCase;
      ping: TriggerSupabaseHealthCheckUseCase;
    },
  ) {}

  async listHealthChecks(c: AdminCtx, query: ListSupabaseHealthChecksQuery) {
    const page = await this.deps.list.execute({
      limit: query.limit,
      cursor: query.cursor,
      env: query.env,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toWire),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async triggerPing(c: AdminCtx) {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError();
    const result = await this.deps.ping.execute({ actorUserId: user.user_id });
    return c.json({ success: true as const, data: result }, 200);
  }
}
