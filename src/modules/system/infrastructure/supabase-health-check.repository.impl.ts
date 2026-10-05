import { and, desc, eq, lt } from 'drizzle-orm';
import { supabaseHealthChecks } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  SupabaseHealthCheck,
  SupabaseHealthCheckFilter,
  SupabaseHealthCheckPage,
  SupabaseHealthCheckRepository,
} from '../domain/repositories/supabase-health-check.repository';

function toEntity(row: typeof supabaseHealthChecks.$inferSelect): SupabaseHealthCheck {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    projectLabel: row.projectLabel,
    projectRef: row.projectRef,
    env: row.env as SupabaseHealthCheck['env'],
    httpStatus: row.httpStatus,
    status: row.status as SupabaseHealthCheck['status'],
    timeStart: row.timeStart,
    timeEnd: row.timeEnd,
    durationMs: row.durationMs,
    githubRunId: row.githubRunId,
    githubRunUrl: row.githubRunUrl,
    errorMessage: row.errorMessage,
  };
}

export class SupabaseHealthCheckRepositoryImpl implements SupabaseHealthCheckRepository {
  constructor(private readonly db: AppDatabase) {}

  async list(filter: SupabaseHealthCheckFilter): Promise<SupabaseHealthCheckPage> {
    const where = [
      filter.env ? eq(supabaseHealthChecks.env, filter.env) : undefined,
      filter.cursor ? lt(supabaseHealthChecks.id, filter.cursor) : undefined,
    ];
    const rows = await this.db
      .select()
      .from(supabaseHealthChecks)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(supabaseHealthChecks.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = (hasMore ? rows.slice(0, filter.limit) : rows).map(toEntity);

    return {
      items: page,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async create(input: Omit<SupabaseHealthCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupabaseHealthCheck> {
    const [row] = await this.db
      .insert(supabaseHealthChecks)
      .values(input)
      .returning();
    return toEntity(row);
  }
}
