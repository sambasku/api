import { and, desc, eq, gt, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { announcements } from '@/shared/database/drizzle/schema/announcements.schema';
import type {
  Announcement,
  AnnouncementRow,
} from '../domain/entities/announcement.entity';
import type {
  AnnouncementRepository,
  CreateAnnouncementInput,
  ListAnnouncementsInput,
  ListAnnouncementsResult,
  UpdateAnnouncementInput,
} from '../domain/repositories/announcement.repository';

function toDomain(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    bodyType: row.bodyType,
    actionUrl: row.actionUrl,
    actionLabel: row.actionLabel,
    createdBy: row.createdBy,
    expiresAt: row.expiresAt,
    pinnedAt: row.pinnedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Keyset cursor ULID sederhana: id monoton waktu, `before` = id terakhir
// halaman sebelumnya (pola ULID time-sortable, tanpa offset).
export class AnnouncementRepositoryImpl implements AnnouncementRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateAnnouncementInput): Promise<Announcement> {
    const [row] = await this.db
      .insert(announcements)
      .values({
        title: input.title,
        body: input.body,
        bodyType: input.bodyType ?? 'plain',
        actionUrl: input.actionUrl ?? null,
        actionLabel: input.actionLabel ?? null,
        createdBy: input.actorId,
        expiresAt: input.expiresAt ?? null,
        pinnedAt: input.pinnedAt ?? null,
      })
      .returning();
    return toDomain(row);
  }

  async findById(id: string): Promise<Announcement | null> {
    const [row] = await this.db
      .select()
      .from(announcements)
      .where(and(eq(announcements.id, id), isNull(announcements.deletedAt)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async list(input: ListAnnouncementsInput): Promise<ListAnnouncementsResult> {
    const conds = [isNull(announcements.deletedAt)];
    if (input.before) {
      // ULID time-sortable: id < before ≈ dibuat lebih dulu.
      conds.push(lt(announcements.id, input.before));
    }
    const rows = await this.db
      .select()
      .from(announcements)
      .where(and(...conds))
      .orderBy(desc(announcements.id))
      .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const items = (hasMore ? rows.slice(0, input.limit) : rows).map(toDomain);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async listPinned(): Promise<Announcement[]> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(announcements)
      .where(
        and(
          isNull(announcements.deletedAt),
          isNotNull(announcements.pinnedAt),
          or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
        ),
      )
      .orderBy(desc(announcements.pinnedAt));
    return rows.map(toDomain);
  }

  async update(input: UpdateAnnouncementInput): Promise<Announcement | null> {
    const values: Partial<typeof announcements.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) values.title = input.title;
    if (input.body !== undefined) values.body = input.body;
    if (input.bodyType !== undefined) values.bodyType = input.bodyType;
    if (input.actionUrl !== undefined) values.actionUrl = input.actionUrl;
    if (input.actionLabel !== undefined) values.actionLabel = input.actionLabel;
    if (input.expiresAt !== undefined) values.expiresAt = input.expiresAt;
    if (input.pinnedAt !== undefined) values.pinnedAt = input.pinnedAt;
    const [row] = await this.db
      .update(announcements)
      .set(values)
      .where(and(eq(announcements.id, input.id), isNull(announcements.deletedAt)))
      .returning();
    return row ? toDomain(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(announcements)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(announcements.id, id), isNull(announcements.deletedAt)))
      .returning({ id: announcements.id });
    return rows.length > 0;
  }
}
