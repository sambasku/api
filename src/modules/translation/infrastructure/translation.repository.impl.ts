import { and, desc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/shared/database/drizzle/schema';
import { translations } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type { Translation, TranslationStatus } from '../domain/entities/translation.entity';
import type {
  CreateTranslationInput,
  ListTranslationsFilter,
  TranslationRepository,
} from '../domain/repositories/translation.repository';

type Db = LibSQLDatabase<typeof schema>;

function mapRow(row: typeof translations.$inferSelect): Translation {
  return {
    id: row.id,
    reff: row.reff,
    reffId: row.reffId,
    body: row.body,
    status: row.status as TranslationStatus,
    translatorId: row.translatorId,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class TranslationRepositoryImpl implements TranslationRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateTranslationInput): Promise<Translation> {
    const id = generateId();
    const now = new Date();
    await this.db.insert(translations).values({
      id,
      reff: input.reff,
      reffId: input.reffId,
      body: input.body,
      status: 'pending',
      translatorId: input.translatorId,
      createdAt: now,
    });
    const row = await this.findById(id);
    if (!row) throw new Error('translation insert missing');
    return row;
  }

  async findById(id: string): Promise<Translation | null> {
    const rows = await this.db
      .select()
      .from(translations)
      .where(eq(translations.id, id))
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async list(filter: ListTranslationsFilter): Promise<Translation[]> {
    const conds = [
      eq(translations.reff, filter.reff),
      eq(translations.reffId, filter.reffId),
    ];
    if (filter.status) conds.push(eq(translations.status, filter.status));
    const rows = await this.db
      .select()
      .from(translations)
      .where(and(...conds))
      .orderBy(desc(translations.createdAt));
    return rows.map(mapRow);
  }

  async findPendingByTranslator(
    reff: string,
    reffId: string,
    translatorId: string,
  ): Promise<Translation | null> {
    const rows = await this.db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.reff, reff),
          eq(translations.reffId, reffId),
          eq(translations.translatorId, translatorId),
          eq(translations.status, 'pending'),
        ),
      )
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findAccepted(reff: string, reffId: string): Promise<Translation | null> {
    const rows = await this.db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.reff, reff),
          eq(translations.reffId, reffId),
          eq(translations.status, 'accepted'),
        ),
      )
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async updateStatus(
    id: string,
    status: TranslationStatus,
    reviewedBy: string,
  ): Promise<Translation> {
    const now = new Date();
    await this.db
      .update(translations)
      .set({
        status,
        reviewedBy,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(translations.id, id));
    const row = await this.findById(id);
    if (!row) throw new Error('translation missing after update');
    return row;
  }

  async rejectPending(reff: string, reffId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(translations)
      .set({
        status: 'rejected',
        reviewedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(translations.reff, reff),
          eq(translations.reffId, reffId),
          eq(translations.status, 'pending'),
        ),
      );
  }
}
