import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { ugcAbuseEvents } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { generateId } from '@/shared/utils/ulid';

export type UgcAbuseSignal =
  | 'input_rejected'
  | 'heavy_censor'
  | 'rate_lockout'
  | 'comment_takedown'
  | 'contribution_spam_reject'
  | 'policy_mute'
  | 'policy_pause'
  | 'policy_deactivate';

export const UGC_ABUSE_WEIGHTS: Record<UgcAbuseSignal, number> = {
  input_rejected: 1,
  heavy_censor: 1,
  rate_lockout: 2,
  comment_takedown: 3,
  contribution_spam_reject: 3,
  policy_mute: 0,
  policy_pause: 0,
  policy_deactivate: 0,
};

export interface UgcAbuseEvent {
  id: string;
  userId: string;
  signal: UgcAbuseSignal;
  weight: number;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RecordUgcAbuseEventInput {
  userId: string;
  signal: UgcAbuseSignal;
  weight?: number;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface UgcAbuseEventRepository {
  record(input: RecordUgcAbuseEventInput): Promise<UgcAbuseEvent>;
  sumWeightSince(userId: string, since: Date): Promise<number>;
  countSignalSince(userId: string, signal: UgcAbuseSignal, since: Date): Promise<number>;
  listByUser(
    userId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ items: UgcAbuseEvent[]; nextCursor: string | null; hasMore: boolean }>;
  findRecentBodyHashes(userId: string, since: Date, limit?: number): Promise<string[]>;
}

function parseMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toEntity(row: typeof ugcAbuseEvents.$inferSelect): UgcAbuseEvent {
  return {
    id: row.id,
    userId: row.userId,
    signal: row.signal as UgcAbuseSignal,
    weight: row.weight,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    meta: parseMeta(row.meta),
    createdAt: row.createdAt,
  };
}

export class UgcAbuseEventRepositoryImpl implements UgcAbuseEventRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(input: RecordUgcAbuseEventInput): Promise<UgcAbuseEvent> {
    const weight = input.weight ?? UGC_ABUSE_WEIGHTS[input.signal] ?? 0;
    const id = generateId();
    const createdAt = new Date();
    const [row] = await this.db
      .insert(ugcAbuseEvents)
      .values({
        id,
        userId: input.userId,
        signal: input.signal,
        weight,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        createdAt,
      })
      .returning();
    return toEntity(row);
  }

  async sumWeightSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`coalesce(sum(${ugcAbuseEvents.weight}), 0)` })
      .from(ugcAbuseEvents)
      .where(and(eq(ugcAbuseEvents.userId, userId), gte(ugcAbuseEvents.createdAt, since)));
    return Number(row?.total ?? 0);
  }

  async countSignalSince(userId: string, signal: UgcAbuseSignal, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(ugcAbuseEvents)
      .where(
        and(
          eq(ugcAbuseEvents.userId, userId),
          eq(ugcAbuseEvents.signal, signal),
          gte(ugcAbuseEvents.createdAt, since),
        ),
      );
    return Number(row?.n ?? 0);
  }

  async listByUser(
    userId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ items: UgcAbuseEvent[]; nextCursor: string | null; hasMore: boolean }> {
    const rows = await this.db
      .select()
      .from(ugcAbuseEvents)
      .where(
        and(
          eq(ugcAbuseEvents.userId, userId),
          opts.cursor
            ? sql`(${ugcAbuseEvents.createdAt}, ${ugcAbuseEvents.id}) < (SELECT created_at, id FROM ugc_abuse_events WHERE id = ${opts.cursor})`
            : undefined,
        ),
      )
      .orderBy(desc(ugcAbuseEvents.createdAt), desc(ugcAbuseEvents.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    return {
      items: page.map(toEntity),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async findRecentBodyHashes(userId: string, since: Date, limit = 20): Promise<string[]> {
    const rows = await this.db
      .select({ meta: ugcAbuseEvents.meta })
      .from(ugcAbuseEvents)
      .where(and(eq(ugcAbuseEvents.userId, userId), gte(ugcAbuseEvents.createdAt, since)))
      .orderBy(desc(ugcAbuseEvents.createdAt))
      .limit(limit);

    const hashes: string[] = [];
    for (const row of rows) {
      const meta = parseMeta(row.meta);
      const h = meta?.body_hash;
      if (typeof h === 'string') hashes.push(h);
    }
    return hashes;
  }
}
