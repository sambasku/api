import { and, desc, eq, sql } from 'drizzle-orm';
import { categorySuggestions } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { CategorySuggestion } from '../domain/entities/category-suggestion.entity';
import type {
  CategorySuggestionRepository,
  CreateCategorySuggestionInput,
} from '../domain/repositories/category-suggestion.repository';

function mapRow(row: any): CategorySuggestion {
  return {
    id: row.id,
    name: row.name,
    reason: row.reason,
    status: row.status as CategorySuggestion['status'],
    proposedBy: row.proposed_by ?? row.proposedBy ?? null,
    contributorName: row.contributor_name ?? row.contributorName ?? null,
    wordSuggestionId: row.word_suggestion_id ?? row.wordSuggestionId ?? null,
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? null,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    rejectReason: row.reject_reason ?? row.rejectReason ?? null,
    createdAt: row.created_at ?? row.createdAt,
  };
}

export class CategorySuggestionRepositoryImpl implements CategorySuggestionRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateCategorySuggestionInput) {
    const rows = await this.db
      .insert(categorySuggestions)
      .values({
        name: input.name,
        reason: input.reason ?? null,
        proposedBy: input.proposedBy ?? null,
        contributorName: input.contributorName ?? null,
        wordSuggestionId: input.wordSuggestionId ?? null,
      })
      .returning();
    return mapRow(rows[0]);
  }

  async findById(id: string) {
    const rows = await this.db.select().from(categorySuggestions).where(eq(categorySuggestions.id, id)).limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findPendingByName(name: string) {
    const rows = await this.db
      .select()
      .from(categorySuggestions)
      .where(
        and(
          sql`lower(${categorySuggestions.name}) = lower(${name})`,
          eq(categorySuggestions.status, 'pending'),
        ),
      )
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async list(status?: CategorySuggestion['status'], limit = 50) {
    const rows = await this.db
      .select()
      .from(categorySuggestions)
      .where(status ? eq(categorySuggestions.status, status) : undefined)
      .orderBy(desc(categorySuggestions.createdAt))
      .limit(limit);
    return rows.map(mapRow);
  }

  async approve(id: string, reviewerId: string) {
    const rows = await this.db
      .update(categorySuggestions)
      .set({ status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(categorySuggestions.id, id), eq(categorySuggestions.status, 'pending')))
      .returning({ id: categorySuggestions.id });
    return rows.length > 0;
  }

  async reject(id: string, reviewerId: string, reason: string) {
    const rows = await this.db
      .update(categorySuggestions)
      .set({ status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date(), rejectReason: reason, updatedAt: new Date() })
      .where(and(eq(categorySuggestions.id, id), eq(categorySuggestions.status, 'pending')))
      .returning({ id: categorySuggestions.id });
    return rows.length > 0;
  }
}