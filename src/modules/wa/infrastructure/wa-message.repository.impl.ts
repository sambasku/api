import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { isUniqueViolation } from '@/shared/database/drizzle/sqlite-errors';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import {
  waMessageLogs,
  waMessageTemplates,
  waUsage,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  WaChannel,
  WaLogStatus,
  WaMessageLog,
  WaMessageTemplate,
  WaTemplateParam,
  WaUsage,
} from '../domain/entities/wa-message.entity';
import type {
  WaLogListQuery,
  WaMessageLogRepository,
  WaTemplateRepository,
  WaTemplateCreateInput, WaTemplateUpdateInput,
  WaUsageRepository,
  WaUsageUpdateInput,
} from '../domain/repositories/wa-message.repository';

function toTemplate(row: typeof waMessageTemplates.$inferSelect): WaMessageTemplate {
  return {
    id: row.id,
    eventKey: row.eventKey,
    enabled: row.enabled,
    metaTemplateName: row.metaTemplateName,
    metaTemplateLanguage: row.metaTemplateLanguage,
    body: row.body,
    params: row.params as WaTemplateParam[],
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export class WaTemplateRepositoryImpl implements WaTemplateRepository {
  constructor(private readonly db: AppDatabase) {}

  async list(): Promise<WaMessageTemplate[]> {
    const rows = await this.db.select().from(waMessageTemplates).orderBy(waMessageTemplates.eventKey);
    return rows.map(toTemplate);
  }

  async create(input: WaTemplateCreateInput, actorId: string): Promise<WaMessageTemplate> {
    const [row] = await this.db
      .insert(waMessageTemplates)
      .values({
        eventKey: input.eventKey,
        enabled: input.enabled,
        metaTemplateName: input.metaTemplateName,
        metaTemplateLanguage: input.metaTemplateLanguage,
        body: input.body,
        params: input.params,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .returning()
      .catch((err: unknown) => {
        if (isUniqueViolation(err)) {
          throw new ConflictError('WA_TEMPLATE_EVENT_KEY_CONFLICT', 'event_key sudah dipakai template lain');
        }
        throw err;
      });
    return toTemplate(row!);
  }

  async getByKey(eventKey: string): Promise<WaMessageTemplate | null> {
    const [row] = await this.db
      .select()
      .from(waMessageTemplates)
      .where(eq(waMessageTemplates.eventKey, eventKey))
      .limit(1);
    return row ? toTemplate(row) : null;
  }

  async update(
    id: string,
    input: WaTemplateUpdateInput,
    actorId: string,
  ): Promise<WaMessageTemplate> {
    const [row] = await this.db
      .update(waMessageTemplates)
      .set({ ...input, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(waMessageTemplates.id, id))
      .returning();
    if (!row) {
      throw new NotFoundError('WA_TEMPLATE_NOT_FOUND', 'Template tidak ditemukan');
    }
    return toTemplate(row);
  }
}

export class WaMessageLogRepositoryImpl implements WaMessageLogRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(entry: Omit<WaMessageLog, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(waMessageLogs).values(entry);
  }

  async list(query: WaLogListQuery): Promise<{ items: WaMessageLog[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const rows = await this.db
      .select()
      .from(waMessageLogs)
      .where(
        query.cursor
          ? and(lt(waMessageLogs.id, query.cursor))
          : sql`1 = 1`,
      )
      .orderBy(desc(waMessageLogs.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        provider: r.provider,
        eventKey: r.eventKey,
        toPhone: r.toPhone,
        templateName: r.templateName,
        channel: r.channel as WaChannel,
        status: r.status as WaLogStatus,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }
}

/** Awal bulan berjalan (WIB, UTC+7) - periode kuota free tier reset tiap tanggal 1 00:00:01 WIB. */
export function currentPeriodStart(now: Date): Date {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 60 * 60 * 1000,
  );
}

export class WaUsageRepositoryImpl implements WaUsageRepository {
  constructor(private readonly db: AppDatabase) {}

  async getActive(provider: string): Promise<WaUsage> {
    const [row] = await this.db
      .select()
      .from(waUsage)
      .where(eq(waUsage.provider, provider))
      .limit(1);
    if (!row) {
      throw new NotFoundError('WA_PROVIDER_NOT_FOUND', 'Provider belum terdaftar di wa_usage');
    }
    const usage = this.toEntity(row);
    const period = currentPeriodStart(new Date());
    if (usage.periodStart.getTime() < period.getTime()) {
      // Lazy reset bulanan - cron mungkin melewatkan (deploy/gagal).
      const [reset] = await this.db
        .update(waUsage)
        .set({ usedCount: 0, periodStart: period, updatedAt: new Date() })
        .where(eq(waUsage.provider, provider))
        .returning();
      return this.toEntity(reset);
    }
    return usage;
  }

  async increment(provider: string, by = 1): Promise<WaUsage> {
    // Atomic SQL - hindari race dua request concurrent (read-then-write
    // bisa kehilangan increment). Reset lazy tetap lewat getActive dulu.
    await this.getActive(provider);
    const [row] = await this.db
      .update(waUsage)
      .set({
        usedCount: sql`${waUsage.usedCount} + ${by}`,
        updatedAt: new Date(),
      })
      .where(eq(waUsage.provider, provider))
      .returning();
    return this.toEntity(row);
  }

  async setUsage(provider: string, input: WaUsageUpdateInput, actorId: string): Promise<WaUsage> {
    const [row] = await this.db
      .update(waUsage)
      .set({ ...input, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(waUsage.provider, provider))
      .returning();
    if (!row) {
      throw new NotFoundError('WA_PROVIDER_NOT_FOUND', 'Provider belum terdaftar di wa_usage');
    }
    return this.toEntity(row);
  }

  private toEntity(row: typeof waUsage.$inferSelect): WaUsage {
    return {
      provider: row.provider,
      usedCount: row.usedCount,
      limitCount: row.limitCount,
      warnThresholdPercent: row.warnThresholdPercent,
      periodStart: row.periodStart,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }
}
