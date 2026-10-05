import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { emailLogs, emailQuotas, emailUsageDaily } from '@/shared/database/drizzle/schema';
import { emailDayUtc } from '@/shared/database/drizzle/schema/email.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  EmailLog,
  EmailLogStatus,
  EmailQuotaWithUsage,
} from '../domain/entities/email.entity';
import type {
  EmailLogEntry,
  EmailLogListQuery,
  EmailLogRepository,
  EmailQuotaRepository,
  EmailQuotaUpdateInput,
  EmailUsageRepository,
} from '../domain/repositories/email.repository';

/** Prefix bulan 'YYYY-MM' dari Date (UTC). */
function monthUtc(now: Date): string {
  return now.toISOString().slice(0, 7);
}

type QuotaRow = typeof emailQuotas.$inferSelect;

/** manual used efektif: 0 kalau manual_month bukan bulan berjalan (lazy reset). */
function effectiveManualUsed(row: QuotaRow, now: Date): number {
  return row.manualMonth === monthUtc(now) ? row.manualMonthlyUsed : 0;
}

async function usageFor(db: AppDatabase, provider: string, now: Date) {
  const month = monthUtc(now);
  const day = emailDayUtc(now);
  const [monthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${emailUsageDaily.sentCount}), 0)` })
    .from(emailUsageDaily)
    .where(
      and(
        eq(emailUsageDaily.provider, provider),
        sql`${emailUsageDaily.day} >= ${`${month}-01`}`,
        sql`${emailUsageDaily.day} < ${nextMonthPrefix(month)}`,
      ),
    );
  const [dayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${emailUsageDaily.sentCount}), 0)` })
    .from(emailUsageDaily)
    .where(and(eq(emailUsageDaily.provider, provider), eq(emailUsageDaily.day, day)));
  return { apiMonthUsed: monthRow?.total ?? 0, todayUsed: dayRow?.total ?? 0 };
}

function nextMonthPrefix(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? { y: y + 1, m: 1 } : { y: y!, m: m! + 1 };
  return `${next.y}-${String(next.m).padStart(2, '0')}-01`;
}

function toEntity(row: QuotaRow, usage: { apiMonthUsed: number; todayUsed: number }, now: Date): EmailQuotaWithUsage {
  const manual = effectiveManualUsed(row, now);
  return {
    provider: row.provider,
    monthlyLimit: row.monthlyLimit,
    dailyLimit: row.dailyLimit,
    manualMonthlyUsed: row.manualMonthlyUsed,
    manualUsedEffective: manual,
    priority: row.priority,
    active: row.active,
    apiMonthUsed: usage.apiMonthUsed,
    todayUsed: usage.todayUsed,
    updatedAt: row.updatedAt,
  };
}

export class EmailQuotaRepositoryImpl implements EmailQuotaRepository {
  constructor(private readonly db: AppDatabase) {}

  async listWithUsage(now: Date): Promise<EmailQuotaWithUsage[]> {
    const rows = await this.db
      .select()
      .from(emailQuotas)
      .orderBy(sql`${emailQuotas.active} desc`, emailQuotas.priority);
    return Promise.all(
      rows.map(async (row) => toEntity(row, await usageFor(this.db, row.provider, now), now)),
    );
  }

  async getOne(provider: string, now: Date): Promise<EmailQuotaWithUsage | null> {
    const [row] = await this.db
      .select()
      .from(emailQuotas)
      .where(eq(emailQuotas.provider, provider))
      .limit(1);
    if (!row) return null;
    return toEntity(row, await usageFor(this.db, provider, now), now);
  }

  async update(provider: string, input: EmailQuotaUpdateInput, actorId: string): Promise<void> {
    const patch: Partial<typeof emailQuotas.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: actorId,
    };
    if (input.monthlyLimit !== undefined) patch.monthlyLimit = input.monthlyLimit;
    if (input.dailyLimit !== undefined) patch.dailyLimit = input.dailyLimit;
    if (input.active !== undefined) patch.active = input.active;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.manualMonthlyUsed !== undefined) {
      patch.manualMonthlyUsed = input.manualMonthlyUsed;
      patch.manualMonth = monthUtc(new Date());
    }
    await this.db.update(emailQuotas).set(patch).where(eq(emailQuotas.provider, provider));
  }
}

export class EmailUsageRepositoryImpl implements EmailUsageRepository {
  constructor(private readonly db: AppDatabase) {}

  async increment(provider: string, now: Date): Promise<void> {
    const day = emailDayUtc(now);
    await this.db
      .insert(emailUsageDaily)
      .values({ provider, day, sentCount: 1 })
      .onConflictDoUpdate({
        target: [emailUsageDaily.provider, emailUsageDaily.day],
        set: { sentCount: sql`${emailUsageDaily.sentCount} + 1` },
      });
  }

  async pruneOlderThan(cutoffDay: string): Promise<void> {
    await this.db.delete(emailUsageDaily).where(lt(emailUsageDaily.day, cutoffDay));
  }
}

export class EmailLogRepositoryImpl implements EmailLogRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(entry: EmailLogEntry): Promise<void> {
    await this.db.insert(emailLogs).values({
      provider: entry.provider,
      category: entry.category,
      toEmail: entry.toEmail,
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
      providerMessageId: entry.providerMessageId ?? null,
    });
  }

  async list(query: EmailLogListQuery): Promise<{ items: EmailLog[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const where = [
      query.cursor ? lt(emailLogs.id, query.cursor) : undefined,
      query.status ? eq(emailLogs.status, query.status) : undefined,
      query.provider ? eq(emailLogs.provider, query.provider) : undefined,
    ].filter(Boolean);
    const rows = await this.db
      .select()
      .from(emailLogs)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(emailLogs.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        provider: r.provider,
        category: r.category as EmailLog['category'],
        toEmail: r.toEmail,
        status: r.status as EmailLogStatus,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        providerMessageId: r.providerMessageId,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async pruneOlderThan(cutoff: Date): Promise<void> {
    await this.db.delete(emailLogs).where(lt(emailLogs.createdAt, cutoff));
  }
}
